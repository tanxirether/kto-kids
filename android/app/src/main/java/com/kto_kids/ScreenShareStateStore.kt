package com.kto_kids

import android.content.Context
import org.json.JSONObject

/**
 * Persists lightweight screen-share session state so JS can read status after process restarts.
 */
object ScreenShareStateStore {
  private const val PREFS = "kto_screen_share_state"
  private const val KEY_ACTIVE = "active"
  private const val KEY_TRACK_ID = "track_id"
  private const val KEY_INTERVAL_MS = "interval_ms"
  private const val KEY_UPDATED_AT_MS = "updated_at_ms"

  fun save(
    context: Context,
    active: Boolean,
    trackId: String,
    intervalMs: Int,
    updatedAtMs: Long = System.currentTimeMillis(),
  ) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ACTIVE, active)
      .putString(KEY_TRACK_ID, trackId)
      .putInt(KEY_INTERVAL_MS, intervalMs)
      .putLong(KEY_UPDATED_AT_MS, updatedAtMs)
      .apply()
  }

  fun clear(context: Context) {
    save(context = context, active = false, trackId = "", intervalMs = 0)
  }

  fun toJson(context: Context): JSONObject {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return JSONObject().apply {
      put("active", prefs.getBoolean(KEY_ACTIVE, false))
      put("trackId", prefs.getString(KEY_TRACK_ID, "") ?: "")
      put("intervalMs", prefs.getInt(KEY_INTERVAL_MS, 0))
      put("updatedAtMs", prefs.getLong(KEY_UPDATED_AT_MS, 0L))
    }
  }
}

