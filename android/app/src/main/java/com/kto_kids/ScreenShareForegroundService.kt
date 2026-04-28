package com.kto_kids

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Android-only foreground service skeleton for long-running screen-share sessions.
 * This does not stream media yet; it keeps process priority and stores active session metadata.
 */
class ScreenShareForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.action ?: ACTION_START
    when (action) {
      ACTION_STOP -> {
        ScreenShareStateStore.clear(this)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        val trackId = intent?.getStringExtra(EXTRA_TRACK_ID)?.trim().orEmpty()
        val intervalMs = intent?.getIntExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS) ?: DEFAULT_INTERVAL_MS
        ensureChannel()
        startForeground(NOTIFICATION_ID, buildNotification(trackId, intervalMs))
        ScreenShareStateStore.save(
          context = this,
          active = true,
          trackId = trackId,
          intervalMs = intervalMs,
        )
        return START_STICKY
      }
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "KTO Kids active parental screen sharing"
        setShowBadge(false)
      }
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(trackId: String, intervalMs: Int): Notification {
    val safeTrack = if (trackId.isBlank()) "unknown" else trackId
    val body = "Parent session active • Track: $safeTrack • Interval: ${intervalMs}ms"
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("KTO Kids Screen Sharing")
      .setContentText(body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  companion object {
    const val CHANNEL_ID = "kto_screen_share_channel"
    private const val CHANNEL_NAME = "KTO Screen Sharing"
    private const val NOTIFICATION_ID = 22110
    private const val DEFAULT_INTERVAL_MS = 2500

    const val ACTION_START = "com.kto_kids.screen_share.START"
    const val ACTION_STOP = "com.kto_kids.screen_share.STOP"
    const val EXTRA_TRACK_ID = "track_id"
    const val EXTRA_INTERVAL_MS = "interval_ms"
  }
}

