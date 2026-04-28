package com.kto_kids

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class ScreenShareModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ScreenShareModule"

  @ReactMethod
  fun startScreenShare(options: ReadableMap?, promise: Promise) {
    try {
      if (!ScreenCaptureConsentStore.isGranted(reactContext)) {
        promise.reject(
          "E_NO_CONSENT",
          "Screen-capture consent not granted. Open permissions and enable screen casting first.",
        )
        return
      }

      val trackId =
        if (options != null && options.hasKey("trackId")) {
          options.getString("trackId")?.trim().orEmpty()
        } else {
          ""
        }
      val intervalMs =
        if (options != null && options.hasKey("intervalMs")) {
          options.getInt("intervalMs").coerceIn(500, 60_000)
        } else {
          2500
        }

      val intent = Intent(reactContext, ScreenShareForegroundService::class.java).apply {
        action = ScreenShareForegroundService.ACTION_START
        putExtra(ScreenShareForegroundService.EXTRA_TRACK_ID, trackId)
        putExtra(ScreenShareForegroundService.EXTRA_INTERVAL_MS, intervalMs)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(reactContext, intent)
      } else {
        reactContext.startService(intent)
      }

      ScreenShareStateStore.save(
        context = reactContext,
        active = true,
        trackId = trackId,
        intervalMs = intervalMs,
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SCREEN_SHARE_START", e.message, e)
    }
  }

  @ReactMethod
  fun stopScreenShare(promise: Promise) {
    try {
      val intent = Intent(reactContext, ScreenShareForegroundService::class.java).apply {
        action = ScreenShareForegroundService.ACTION_STOP
      }
      reactContext.startService(intent)
      ScreenShareStateStore.clear(reactContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SCREEN_SHARE_STOP", e.message, e)
    }
  }

  @ReactMethod
  fun getScreenShareState(promise: Promise) {
    try {
      val state = ScreenShareStateStore.toJson(reactContext)
      val map = Arguments.createMap().apply {
        putBoolean("active", state.optBoolean("active", false))
        putString("trackId", state.optString("trackId", ""))
        putInt("intervalMs", state.optInt("intervalMs", 0))
        putDouble("updatedAtMs", state.optLong("updatedAtMs", 0L).toDouble())
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_SCREEN_SHARE_STATE", e.message, e)
    }
  }
}

