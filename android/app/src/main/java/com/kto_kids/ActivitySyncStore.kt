package com.kto_kids

import android.content.Context

object ActivitySyncStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_LAST_ACTIVITIES_SYNC_MS = "last_activities_sync_ms"
  private const val KEY_LAST_LOCATION_SYNC_MS = "last_location_sync_ms"

  fun setLastSyncMs(context: Context, tsMs: Long) {
    if (tsMs <= 0L) return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putLong(KEY_LAST_ACTIVITIES_SYNC_MS, tsMs).apply()
  }

  fun getLastSyncMs(context: Context): Long {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return prefs.getLong(KEY_LAST_ACTIVITIES_SYNC_MS, 0L)
  }

  fun setLastLocationSyncMs(context: Context, tsMs: Long) {
    if (tsMs <= 0L) return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putLong(KEY_LAST_LOCATION_SYNC_MS, tsMs).apply()
  }

  fun getLastLocationSyncMs(context: Context): Long {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return prefs.getLong(KEY_LAST_LOCATION_SYNC_MS, 0L)
  }
}
