package com.kto_kids

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * A real foreground service (with a persistent notification) dedicated to location tracking.
 *
 * Why this exists: a plain background process - even one kept alive via battery-optimization
 * whitelisting - still has its location requests throttled by Android's Doze "light idle" mode
 * after a few minutes of screen-off (confirmed via `dumpsys location` showing
 * ProviderRequest[OFF] once light idle kicked in). A genuine foreground service declaring
 * foregroundServiceType="location" is specifically exempted from that throttling, which is the
 * only officially supported way to get consistent location updates while the screen is off.
 */
class LocationForegroundService : Service() {
  private val tag = "LocationForegroundSvc"

  companion object {
    private const val CHANNEL_ID = "kto_kids_location_channel"
    private const val NOTIFICATION_ID = 1002

    /** Starts the service, swallowing the Android 12+ "not allowed to start from background"
     * exception so a bad call site never crashes the caller; near-live tracking just falls back
     * to whatever MyAccessibilityService's direct listener can get in that case. */
    fun ensureStarted(context: Context) {
      try {
        val intent = Intent(context, LocationForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (t: Throwable) {
        Log.e("LocationForegroundSvc", "ensureStarted failed: ${t.message}", t)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    try {
      createChannelIfNeeded()
      promoteToForeground()
      LocationTrackingManager.start(this)
      Log.d(tag, "Location foreground service started")
    } catch (t: Throwable) {
      Log.e(tag, "onCreate failed: ${t.message}", t)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // START_STICKY: ask the OS to recreate the service (onCreate runs again) if it's ever
    // killed under memory pressure, instead of leaving location tracking off silently.
    // Re-promote so camera/microphone types are picked up once those permissions get granted.
    try {
      promoteToForeground()
    } catch (t: Throwable) {
      Log.e(tag, "re-promote failed: ${t.message}", t)
    }
    return START_STICKY
  }

  /**
   * Android 11+ blocks camera/mic use from the background unless the app has a running
   * foreground service of that type that was started while the app was visible. Declaring them
   * here (only when granted, otherwise startForeground throws SecurityException) is what lets
   * the parent's remote camera / one-way audio keep working after the app is swiped away.
   */
  private fun promoteToForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification)
      return
    }
    var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
    if (granted(android.Manifest.permission.CAMERA)) {
      type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    }
    if (granted(android.Manifest.permission.RECORD_AUDIO)) {
      type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    }
    try {
      startForeground(NOTIFICATION_ID, notification, type)
    } catch (t: Throwable) {
      // Fall back to location-only so tracking never goes down because of camera/mic.
      Log.w(tag, "startForeground with type=$type failed (${t.message}); using location only")
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    }
  }

  private fun granted(permission: String) =
    checkSelfPermission(permission) == android.content.pm.PackageManager.PERMISSION_GRANTED

  override fun onDestroy() {
    try {
      LocationTrackingManager.stop()
    } catch (_: Throwable) {
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannelIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(CHANNEL_ID, "Location monitoring", NotificationManager.IMPORTANCE_MIN).apply {
        description = "Keeps location updates flowing while the screen is off."
        setShowBadge(false)
      }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
      }
    val iconRes = resources.getIdentifier("ic_launcher", "mipmap", packageName)
    return builder
      .setContentTitle("KTO Kids")
      .setContentText("Location monitoring active")
      .setSmallIcon(if (iconRes != 0) iconRes else android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .setPriority(Notification.PRIORITY_MIN)
      .build()
  }
}
