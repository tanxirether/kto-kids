package com.kto_kids

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.util.Calendar

object UsageStatsReader {

  fun usageAccessDebug(context: Context): JSONObject {
    val obj = JSONObject()
    try {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName,
          )
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName,
          )
        }
      obj.put("appOpsMode", mode)
    } catch (t: Throwable) {
      obj.put("appOpsModeError", t.message ?: "error")
    }

    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 1000L * 60L * 5L
      val events = usm.queryEvents(start, end)
      obj.put("hasAnyEvents", events.hasNextEvent())
    } catch (t: Throwable) {
      obj.put("eventsError", t.message ?: "error")
    }

    try {
      obj.put("currentForegroundPackage", getCurrentForegroundPackage(context))
    } catch (t: Throwable) {
      obj.put("currentForegroundError", t.message ?: "error")
    }

    return obj
  }

  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(),
          context.packageName,
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          android.os.Process.myUid(),
          context.packageName,
        )
      }
    if (mode == AppOpsManager.MODE_ALLOWED) return true

    // Some OEM builds keep reporting MODE_DEFAULT even when the toggle is enabled.
    // Fall back to a real query: if events are readable, treat as granted.
    return try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 1000L * 60L * 5L
      val events = usm.queryEvents(start, end)
      events.hasNextEvent()
    } catch (_: Throwable) {
      false
    }
  }

  fun openUsageAccessSettingsIntent(): Intent {
    return Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }

  fun getTodayUsageMs(context: Context): JSONObject {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    val cal = Calendar.getInstance()
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    val start = cal.timeInMillis
    val end = System.currentTimeMillis()

    val events: UsageEvents = usm.queryEvents(start, end)
    val result = mutableMapOf<String, Long>()

    var lastPkg: String? = null
    var lastTs: Long = 0L
    val e = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(e)

      val pkg = e.packageName ?: continue
      val ts = e.timeStamp

      when (e.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND,
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          lastPkg = pkg
          lastTs = ts
        }

        UsageEvents.Event.MOVE_TO_BACKGROUND,
        UsageEvents.Event.ACTIVITY_PAUSED,
        UsageEvents.Event.ACTIVITY_STOPPED -> {
          if (lastPkg != null && lastTs > 0 && pkg == lastPkg) {
            val dt = ts - lastTs
            if (dt in 1..(12 * 60 * 60 * 1000L)) {
              result[lastPkg!!] = (result[lastPkg!!] ?: 0L) + dt
            }
          }
          lastPkg = null
          lastTs = 0L
        }
      }
    }

    // If still in foreground, count up to now
    if (lastPkg != null && lastTs > 0) {
      val dt = end - lastTs
      if (dt in 1..(12 * 60 * 60 * 1000L)) {
        result[lastPkg!!] = (result[lastPkg!!] ?: 0L) + dt
      }
    }

    val obj = JSONObject()
    result.forEach { (pkg, ms) -> obj.put(pkg, ms) }
    return obj
  }

  fun getCurrentForegroundPackage(context: Context): String {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = end - 1000L * 60L * 10L // last 10 minutes
    val events = usm.queryEvents(start, end)
    val e = UsageEvents.Event()
    var current: String? = null

    while (events.hasNextEvent()) {
      events.getNextEvent(e)
      val pkg = e.packageName ?: continue
      when (e.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND,
        UsageEvents.Event.ACTIVITY_RESUMED -> current = pkg
      }
    }
    return current ?: ""
  }
}

