package com.kto_kids

import android.content.Context

/**
 * Remembers that the user completed the system screen-capture consent flow (MediaProjection).
 */
object ScreenCaptureConsentStore {
  private const val PREFS = "kto_screen_capture"
  private const val KEY_GRANTED = "consent_granted"

  fun isGranted(context: Context): Boolean {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getBoolean(KEY_GRANTED, false)
  }

  fun setGranted(context: Context, granted: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_GRANTED, granted)
      .apply()
  }
}
