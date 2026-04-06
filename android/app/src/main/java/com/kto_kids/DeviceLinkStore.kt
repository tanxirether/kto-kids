package com.kto_kids

import android.content.Context

/**
 * Mirrors JS AsyncStorage `trackid` so native JobScheduler / services can read it without RN.
 */
object DeviceLinkStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_TRACK_ID = "linked_track_id"

  fun setTrackId(context: Context, trackId: String) {
    val v = trackId.trim()
    if (v.isBlank()) return
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TRACK_ID, v).apply()
  }

  fun getTrackId(context: Context): String {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TRACK_ID, "")?.trim().orEmpty()
  }
}
