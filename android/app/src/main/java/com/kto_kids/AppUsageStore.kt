package com.kto_kids

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object AppUsageStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_USAGE_BY_DAY = "usage_by_day_json"

  private fun todayKey(nowMs: Long = System.currentTimeMillis()): String {
    val sdf =
      SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    return sdf.format(Date(nowMs))
  }

  private fun loadAll(context: Context): JSONObject {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_USAGE_BY_DAY, "{}") ?: "{}"
    return try {
      JSONObject(raw)
    } catch (_: Throwable) {
      JSONObject()
    }
  }

  private fun saveAll(context: Context, root: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_USAGE_BY_DAY, root.toString()).apply()
  }

  fun addUsageMs(context: Context, packageName: String, durationMs: Long, nowMs: Long) {
    if (packageName.isBlank()) return
    if (durationMs <= 0) return

    val day = todayKey(nowMs)
    val root = loadAll(context)
    val dayObj = root.optJSONObject(day) ?: JSONObject().also { root.put(day, it) }

    val prev = dayObj.optLong(packageName, 0L)
    dayObj.put(packageName, prev + durationMs)

    // Keep storage bounded: retain last 14 days
    pruneOldDays(root, keepDays = 14)
    saveAll(context, root)
  }

  fun getUsageMsForDay(context: Context, day: String): JSONObject {
    val root = loadAll(context)
    return root.optJSONObject(day) ?: JSONObject()
  }

  fun getTodayUsageMs(context: Context, nowMs: Long = System.currentTimeMillis()): JSONObject {
    return getUsageMsForDay(context, todayKey(nowMs))
  }

  fun clearAll(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_USAGE_BY_DAY).apply()
  }

  private fun pruneOldDays(root: JSONObject, keepDays: Int) {
    if (keepDays <= 0) return
    val keys = root.keys().asSequence().toList().sorted()
    val toRemoveCount = keys.size - keepDays
    if (toRemoveCount <= 0) return
    keys.take(toRemoveCount).forEach { root.remove(it) }
  }
}

