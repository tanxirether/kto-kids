package com.kto_kids

import android.content.Context
import android.database.sqlite.SQLiteDatabase

/**
 * Resolves the linked child trackId from whichever store currently has it, so native
 * services (JobScheduler, AccessibilityService) can read it without going through RN.
 * Shared by MonitoringSyncJobService and LocationTrackingManager.
 */
object TrackIdResolver {
  fun resolve(context: Context): String {
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
