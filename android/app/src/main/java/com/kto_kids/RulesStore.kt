package com.kto_kids

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object RulesStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_LIMITS_BY_PACKAGE = "limits_by_package_json" // ms per day
  private const val KEY_KEYWORDS = "keywords_json"

  fun setDailyLimitsMs(context: Context, limits: Map<String, Long>) {
    val obj = JSONObject()
    limits.forEach { (pkg, ms) ->
      val p = pkg.trim()
      if (p.isBlank()) return@forEach
      if (ms <= 0) return@forEach
      obj.put(p, ms)
    }
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_LIMITS_BY_PACKAGE, obj.toString()).apply()
  }

  fun getDailyLimitsMs(context: Context): JSONObject {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_LIMITS_BY_PACKAGE, "{}") ?: "{}"
    return try {
      JSONObject(raw)
    } catch (_: Throwable) {
      JSONObject()
    }
  }

  fun getLimitMsForPackage(context: Context, packageName: String): Long {
    if (packageName.isBlank()) return 0L
    val obj = getDailyLimitsMs(context)
    return obj.optLong(packageName, 0L)
  }

  fun setKeywords(context: Context, keywords: List<String>) {
    val cleaned =
      keywords
        .asSequence()
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .distinctBy { it.lowercase() }
        .toList()

    val arr = JSONArray()
    cleaned.forEach { arr.put(it) }

    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_KEYWORDS, arr.toString()).apply()
  }

  fun getKeywords(context: Context): List<String> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_KEYWORDS, "[]") ?: "[]"
    return try {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until arr.length()) {
          val v = arr.optString(i, "").trim()
          if (v.isNotBlank()) add(v)
        }
      }
    } catch (_: Throwable) {
      emptyList()
    }
  }
}

