package com.kto_kids

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.modules.core.DeviceEventManagerModule

class MyAccessibilityService : AccessibilityService() {
  private var lastForegroundPackage: String? = null
  private var lastForegroundStartMs: Long = 0L
  private var lastKeywordAlertMs: Long = 0L
  private val tag = "MyAccessibilityService"

  override fun onServiceConnected() {
    try {
      super.onServiceConnected()

      val info =
        AccessibilityServiceInfo().apply {
          eventTypes =
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
              AccessibilityEvent.TYPE_VIEW_CLICKED or
              AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
          feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
          notificationTimeout = 100
          packageNames = null // monitor all apps; optionally filter to specific packages
        }

      serviceInfo = info
      ServiceHealthStore.setAccessibilityError(this, "", 0L)
    } catch (t: Throwable) {
      val msg = "${t.javaClass.simpleName}: ${t.message ?: "unknown"}"
      Log.e(tag, "onServiceConnected crashed: $msg", t)
      ServiceHealthStore.setAccessibilityError(this, "onServiceConnected: $msg", System.currentTimeMillis())
      // Let Android manage restart/backoff; we don't rethrow to avoid crash-loop classification.
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    try {
      if (event == null) return
      ServiceHealthStore.noteAccessibilityEvent(this, System.currentTimeMillis())

      val packageName = event.packageName?.toString() ?: return
      val className = event.className?.toString()
      val eventType = event.eventType

      if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
        if (packageName != lastForegroundPackage) {
          val now = System.currentTimeMillis()
          lastForegroundPackage?.let { prev ->
            if (lastForegroundStartMs > 0 && prev != this.packageName) {
              val dt = now - lastForegroundStartMs
              if (dt in 1..(12 * 60 * 60 * 1000L)) {
                AppUsageStore.addUsageMs(this, prev, dt, now)
              }
            }
          }

          lastForegroundPackage = packageName
          lastForegroundStartMs = now
          LastForegroundStore.set(this, packageName, now)
          enforceIfBlocked(packageName)
          enforceIfTimeExceeded(packageName)
        }
      }

      if (eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
        detectKeywords(packageName, event)
      }

      sendEventToReactNative(packageName, className, eventType)
    } catch (t: Throwable) {
      val msg = "${t.javaClass.simpleName}: ${t.message ?: "unknown"}"
      Log.e(tag, "onAccessibilityEvent crashed: $msg", t)
      ServiceHealthStore.setAccessibilityError(this, "onAccessibilityEvent: $msg", System.currentTimeMillis())
      // swallow to avoid Android marking the service as crashed
    }
  }

  override fun onInterrupt() {}

  private fun enforceIfBlocked(packageName: String) {
    // Don't block our own app; otherwise we'd lock ourselves out.
    if (packageName == this.packageName) return

    if (!BlockedAppsStore.isBlocked(this, packageName)) return

    val intent =
      Intent(this, BlockedAppActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra("blockedPackage", packageName)
      }

    try {
      startActivity(intent)
    } catch (t: Throwable) {
      val msg = "${t.javaClass.simpleName}: ${t.message ?: "unknown"}"
      Log.e(tag, "startActivity (blocked) failed: $msg", t)
      ServiceHealthStore.setAccessibilityError(this, "blockedUI: $msg", System.currentTimeMillis())
    }
  }

  private fun enforceIfTimeExceeded(packageName: String) {
    if (packageName == this.packageName) return

    val limitMs = RulesStore.getLimitMsForPackage(this, packageName)
    if (limitMs <= 0) return

    val usedToday = AppUsageStore.getTodayUsageMs(this).optLong(packageName, 0L)
    if (usedToday < limitMs) return

    val intent =
      Intent(this, BlockedAppActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra("blockedPackage", packageName)
      }
    try {
      startActivity(intent)
    } catch (t: Throwable) {
      val msg = "${t.javaClass.simpleName}: ${t.message ?: "unknown"}"
      Log.e(tag, "startActivity (limit) failed: $msg", t)
      ServiceHealthStore.setAccessibilityError(this, "limitUI: $msg", System.currentTimeMillis())
    }
  }

  private fun sendEventToReactNative(packageName: String, className: String?, eventType: Int) {
    val reactContext = ReactContextHolder.get() ?: return

    val params =
      com.facebook.react.bridge.Arguments.createMap().apply {
        putString("packageName", packageName)
        putString("className", className)
        putInt("eventType", eventType)
      }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("AccessibilityEventDetected", params)
  }

  private fun detectKeywords(packageName: String, event: AccessibilityEvent) {
    if (packageName == this.packageName) return

    // Throttle to reduce spam and CPU. 1 alert per 5 seconds.
    val now = System.currentTimeMillis()
    if (now - lastKeywordAlertMs < 5000) return

    val keywords = RulesStore.getKeywords(this)
    if (keywords.isEmpty()) return

    val pieces = mutableListOf<String>()
    try {
      event.text?.forEach { t -> if (t != null) pieces.add(t.toString()) }
    } catch (_: Throwable) {}
    val combined = pieces.joinToString(" ").trim()
    if (combined.isBlank()) return

    val lower = combined.lowercase()
    val hit = keywords.firstOrNull { kw -> kw.isNotBlank() && lower.contains(kw.lowercase()) } ?: return

    lastKeywordAlertMs = now
    sendKeywordAlertToReactNative(packageName, hit, combined.take(200))
  }

  private fun sendKeywordAlertToReactNative(packageName: String, keyword: String, snippet: String) {
    val reactContext = ReactContextHolder.get() ?: return

    val params =
      com.facebook.react.bridge.Arguments.createMap().apply {
        putString("packageName", packageName)
        putString("keyword", keyword)
        putString("snippet", snippet)
        putDouble("timestampMs", System.currentTimeMillis().toDouble())
      }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("KeywordDetected", params)
  }
}

