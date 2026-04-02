package com.kto_kids

import android.content.Context
import org.json.JSONArray

object BlockedAppsStore {
  private const val PREFS = "kto_kids_parental_controls"
  private const val KEY_BLOCKED_PACKAGES = "blocked_packages_json"

  fun getBlockedPackages(context: Context): Set<String> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_BLOCKED_PACKAGES, "[]") ?: "[]"
    return try {
      val arr = JSONArray(raw)
      buildSet {
        for (i in 0 until arr.length()) {
          val v = arr.optString(i, "")
          if (v.isNotBlank()) add(v)
        }
      }
    } catch (_: Throwable) {
      emptySet()
    }
  }

  fun setBlockedPackages(context: Context, packages: List<String>) {
    val cleaned =
      packages
        .asSequence()
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .distinct()
        .toList()

    val arr = JSONArray()
    cleaned.forEach { arr.put(it) }

    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_BLOCKED_PACKAGES, arr.toString()).apply()
  }

  fun isBlocked(context: Context, packageName: String): Boolean {
    if (packageName.isBlank()) return false
    return getBlockedPackages(context).contains(packageName)
  }
}

