package com.kto_kids

import android.app.job.JobParameters
import android.app.job.JobService
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.content.pm.PackageManager
import android.util.Log
import org.json.JSONObject
import java.io.BufferedWriter
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max
import kotlin.math.roundToInt

class MonitoringSyncJobService : JobService() {
  private val tag = "MonitoringSyncJob"
  @Volatile private var runningThread: Thread? = null

  override fun onStartJob(params: JobParameters?): Boolean {
    val thread =
      Thread {
        try {
          runSync()
        } catch (t: Throwable) {
          Log.e(tag, "runSync failed: ${t.message}", t)
        } finally {
          jobFinished(params, false)
        }
      }
    runningThread = thread
    thread.start()
    return true
  }

  override fun onStopJob(params: JobParameters?): Boolean {
    runningThread?.interrupt()
    runningThread = null
    return true
  }

  /**
   * Usage Debug screen prefers UsageStats when granted; accessibility-only store may differ.
   * Merge by max ms per package so background sync matches what you see in-app.
   */
  private fun mergedTodayUsageMs(context: Context): JSONObject {
    val fromAccessibility = AppUsageStore.getTodayUsageMs(context)
    if (!UsageStatsReader.hasUsageAccess(context)) {
      return fromAccessibility
    }
    val fromStats = UsageStatsReader.getTodayUsageMs(context)
    val keys = mutableSetOf<String>()
    val it1 = fromAccessibility.keys()
    while (it1.hasNext()) keys.add(it1.next())
    val it2 = fromStats.keys()
    while (it2.hasNext()) keys.add(it2.next())
    val out = JSONObject()
    for (k in keys) {
      val a = fromAccessibility.optLong(k, 0L)
      val b = fromStats.optLong(k, 0L)
      out.put(k, max(a, b))
    }
    return out
  }

  private fun runSync() {
    val trackId = resolveTrackId(this)
    if (trackId.isBlank()) {
      Log.w(tag, "Track ID missing; skip monitoring sync")
      return
    }

    val usageByPackage = mergedTodayUsageMs(this)
    val activityPaths =
      listOf(
        "/activities",
        "/monitoring/activities",
        "/usage/activities",
      )
    val snapshotPaths =
      listOf(
        "/monitoring/usage-snapshot",
        "/usage/snapshot",
        "/monitoring/snapshot",
      )
    val base = "https://api.kto.solutions/api/v1"

    // Primary path: send per-app usage activity rows.
    var activitiesUploaded = 0
    val usageIterator = usageByPackage.keys()
    while (usageIterator.hasNext()) {
      val packageName = usageIterator.next()
      val durationMs = usageByPackage.optLong(packageName, 0L)
      val durationMinutes = (durationMs.toDouble() / 60000.0).roundToInt().coerceAtLeast(0)
      if (packageName.isBlank() || durationMinutes <= 0) continue

      val body =
        JSONObject()
          .put("trackId", trackId)
          .put("appName", resolveAppName(this, packageName))
          .put("packageName", packageName)
          .put("durationMinutes", durationMinutes)

      var sent = false
      var lastError: String? = null
      for (path in activityPaths) {
        val res = postJson("$base$path", body.toString())
        if (res == null) {
          sent = true
          activitiesUploaded += 1
          break
        }
        lastError = res
      }
      if (!sent) {
        Log.w(tag, "Activity upload failed for $packageName: $lastError")
      }
    }

    if (activitiesUploaded > 0) {
      ActivitySyncStore.setLastSyncMs(this, System.currentTimeMillis())
      Log.d(tag, "Monitoring activities uploaded: $activitiesUploaded")
      return
    }

    // Fallback: keep older snapshot behavior for compatibility if activities endpoint is unavailable.
    val health = buildHealth(this)
    val payload =
      JSONObject()
        .put("trackId", trackId)
        .put("capturedAtMs", System.currentTimeMillis())
        .put(
          "snapshot",
          JSONObject()
            .put("kind", "periodic")
            .put("health", health)
            .put("usageByPackage", usageByPackage),
        )

    var snapshotOk = false
    var snapshotError: String? = null
    for (path in snapshotPaths) {
      val res = postJson("$base$path", payload.toString())
      if (res == null) {
        snapshotOk = true
        break
      }
      snapshotError = res
    }

    if (snapshotOk) {
      ActivitySyncStore.setLastSyncMs(this, System.currentTimeMillis())
      Log.d(tag, "Monitoring snapshot fallback uploaded")
    } else {
      Log.w(tag, "Monitoring sync upload failed: $snapshotError")
    }
  }

  private fun resolveAppName(context: Context, packageName: String): String {
    return try {
      val pm = context.packageManager
      val appInfo = pm.getApplicationInfo(packageName, 0)
      val label = pm.getApplicationLabel(appInfo)?.toString()?.trim().orEmpty()
      if (label.isNotBlank()) label else packageName
    } catch (_: PackageManager.NameNotFoundException) {
      packageName
    } catch (_: Throwable) {
      packageName
    }
  }

  private fun buildHealth(context: Context): JSONObject {
    val (lastError, lastErrorTs) = ServiceHealthStore.getAccessibilityError(context)
    val (lastEventTs, eventCount) = ServiceHealthStore.getAccessibilityHeartbeat(context)
    val (lastForegroundPkg, lastForegroundTs) = LastForegroundStore.get(context)
    val now = System.currentTimeMillis()

    return JSONObject()
      .put("isAccessibilityEnabled", isAccessibilityEnabled(context))
      .put("hasUsageAccess", UsageStatsReader.hasUsageAccess(context))
      .put("lastError", lastError)
      .put("lastErrorTsMs", lastErrorTs)
      .put("lastAccessibilityEventTsMs", lastEventTs)
      .put("accessibilityEventCount", eventCount)
      .put("accessibilityStaleMs", if (lastEventTs > 0L) now - lastEventTs else -1L)
      .put("lastForegroundPackage", lastForegroundPkg)
      .put("lastForegroundTsMs", lastForegroundTs)
  }

  private fun postJson(url: String, jsonBody: String): String? {
    return try {
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15000
        readTimeout = 15000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }

      BufferedWriter(OutputStreamWriter(connection.outputStream, Charsets.UTF_8)).use { writer ->
        writer.write(jsonBody)
      }

      val code = connection.responseCode
      if (code in 200..299) {
        null
      } else {
        "HTTP $code"
      }
    } catch (t: Throwable) {
      t.message ?: "network_error"
    }
  }

  private fun isAccessibilityEnabled(context: Context): Boolean {
    val enabledServices =
      android.provider.Settings.Secure.getString(
        context.contentResolver,
        android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
        ?: ""
    val expected = "${context.packageName}/${MyAccessibilityService::class.java.name}"
    return enabledServices.contains(expected, ignoreCase = true)
  }

  private fun resolveTrackId(context: Context): String {
    val linked = DeviceLinkStore.getTrackId(context)
    if (linked.isNotBlank()) return linked

    // Try known AsyncStorage persistence locations first.
    val sharedPrefFiles = listOf("ReactNative", "ReactNativeSharedPreferences", "AsyncStorage")
    val sharedPrefKeys = listOf("trackid", "@trackid")

    for (file in sharedPrefFiles) {
      val prefs = context.getSharedPreferences(file, Context.MODE_PRIVATE)
      for (k in sharedPrefKeys) {
        val v = prefs.getString(k, null)?.trim().orEmpty()
        if (v.isNotBlank()) return v
      }
    }

    // Fallback to legacy AsyncStorage SQLite database.
    return queryTrackIdFromDb(context).trim()
  }

  private fun queryTrackIdFromDb(context: Context): String {
    val dbCandidates = listOf("RKStorage", "AsyncStorage")
    val keys = listOf("trackid", "@trackid")
    for (dbName in dbCandidates) {
      val path = context.getDatabasePath(dbName)
      if (!path.exists()) continue
      var db: SQLiteDatabase? = null
      try {
        db = SQLiteDatabase.openDatabase(path.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
        for (key in keys) {
          val cursor =
            db.rawQuery(
              "SELECT value FROM catalystLocalStorage WHERE key = ? LIMIT 1",
              arrayOf(key),
            )
          cursor.use {
            if (it.moveToFirst()) {
              val v = it.getString(0)?.trim().orEmpty()
              if (v.isNotBlank()) return v
            }
          }
        }
      } catch (_: Throwable) {
      } finally {
        db?.close()
      }
    }
    return ""
  }
}
