package com.kto_kids

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log

object MonitoringJobScheduler {
  private const val TAG = "MonitoringJobScheduler"
  private const val JOB_ID = 331001

  fun schedule(context: Context) {
    try {
      val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
      val component = ComponentName(context, MonitoringSyncJobService::class.java)

      val builder =
        JobInfo
          .Builder(JOB_ID, component)
          .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
          .setPersisted(true)
          .setPeriodic(15 * 60 * 1000L)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setRequiresBatteryNotLow(false)
      }

      val result = scheduler.schedule(builder.build())
      if (result == JobScheduler.RESULT_SUCCESS) {
        Log.d(TAG, "Scheduled monitoring periodic sync job")
      } else {
        Log.w(TAG, "Failed to schedule monitoring sync job: $result")
      }
    } catch (t: Throwable) {
      Log.e(TAG, "schedule failed: ${t.message}", t)
    }
  }
}
