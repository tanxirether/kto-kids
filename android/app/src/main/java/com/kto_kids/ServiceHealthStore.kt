package com.kto_kids

import android.content.Context

object ServiceHealthStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_LAST_ACCESSIBILITY_ERROR = "last_accessibility_error"
  private const val KEY_LAST_ACCESSIBILITY_ERROR_TS = "last_accessibility_error_ts"

  fun setAccessibilityError(context: Context, message: String, tsMs: Long) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs
      .edit()
      .putString(KEY_LAST_ACCESSIBILITY_ERROR, message.take(500))
      .putLong(KEY_LAST_ACCESSIBILITY_ERROR_TS, tsMs)
      .apply()
  }

  fun getAccessibilityError(context: Context): Pair<String, Long> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val msg = prefs.getString(KEY_LAST_ACCESSIBILITY_ERROR, "") ?: ""
    val ts = prefs.getLong(KEY_LAST_ACCESSIBILITY_ERROR_TS, 0L)
    return msg to ts
  }
}

