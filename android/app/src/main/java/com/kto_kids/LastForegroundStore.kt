package com.kto_kids

import android.content.Context

object LastForegroundStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_LAST_PKG = "last_foreground_pkg"
  private const val KEY_LAST_TS = "last_foreground_ts"

  fun set(context: Context, packageName: String, tsMs: Long) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs
      .edit()
      .putString(KEY_LAST_PKG, packageName)
      .putLong(KEY_LAST_TS, tsMs)
      .apply()
  }

  fun get(context: Context): Pair<String, Long> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val pkg = prefs.getString(KEY_LAST_PKG, "") ?: ""
    val ts = prefs.getLong(KEY_LAST_TS, 0L)
    return pkg to ts
  }
}

