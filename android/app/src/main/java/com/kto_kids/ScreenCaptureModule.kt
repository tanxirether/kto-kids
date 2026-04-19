package com.kto_kids

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Presents the system dialog to allow screen capture (MediaProjection), used for parent screen view / casting.
 */
class ScreenCaptureModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val requestCode = 0x7e01
  private var pending: Promise? = null

  private val listener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != this@ScreenCaptureModule.requestCode) return
        val p = pending ?: return
        pending = null
        if (resultCode == Activity.RESULT_OK && data != null) {
          ScreenCaptureConsentStore.setGranted(reactContext, true)
          p.resolve(true)
        } else {
          ScreenCaptureConsentStore.setGranted(reactContext, false)
          p.resolve(false)
        }
      }
    }

  init {
    reactContext.addActivityEventListener(listener)
  }

  override fun getName() = "ScreenCaptureModule"

  @ReactMethod
  fun hasScreenCaptureConsent(promise: Promise) {
    try {
      promise.resolve(ScreenCaptureConsentStore.isGranted(reactContext))
    } catch (e: Exception) {
      promise.reject("E_SCREEN_CAPTURE", e.message, e)
    }
  }

  @ReactMethod
  fun requestScreenCaptureConsent(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity")
      return
    }
    if (pending != null) {
      promise.reject("E_PENDING", "Screen capture request already in progress")
      return
    }
    try {
      pending = promise
      val mpm = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val captureIntent = mpm.createScreenCaptureIntent()
      @Suppress("DEPRECATION")
      activity.startActivityForResult(captureIntent, requestCode)
    } catch (e: Exception) {
      pending = null
      promise.reject("E_SCREEN_CAPTURE", e.message, e)
    }
  }
}
