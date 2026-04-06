package com.kto_kids

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootCompletedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_LOCKED_BOOT_COMPLETED,
      Intent.ACTION_USER_UNLOCKED,
      -> MonitoringJobScheduler.schedule(context)
    }
  }
}
