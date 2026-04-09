package com.kto_kids

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.gms.tasks.Tasks
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DeviceAccessModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "DeviceAccessModule"

  override fun initialize() {
    super.initialize()
    ReactContextHolder.set(reactContext)
  }

  @ReactMethod
  fun openAccessibilitySettings() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun isAccessibilityEnabled(promise: Promise) {
    val enabledServices =
      Settings.Secure.getString(
        reactContext.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
        ?: ""

    val expected = "${reactContext.packageName}/${MyAccessibilityService::class.java.name}"
    promise.resolve(enabledServices.contains(expected, ignoreCase = true))
  }

  @ReactMethod
  fun setBlockedPackages(packages: ReadableArray) {
    val list = mutableListOf<String>()
    for (i in 0 until packages.size()) {
      val v = packages.getString(i)
      if (v != null) list.add(v)
    }
    BlockedAppsStore.setBlockedPackages(reactContext, list)
  }

  @ReactMethod
  fun getBlockedPackages(promise: Promise) {
    val set = BlockedAppsStore.getBlockedPackages(reactContext).toList()
    val arr = com.facebook.react.bridge.Arguments.createArray()
    set.forEach { arr.pushString(it) }
    promise.resolve(arr)
  }

  /**
   * limitsMsByPackage: { "com.instagram.android": 3600000, ... } (ms per day)
   */
  @ReactMethod
  fun setDailyLimitsMs(limitsMsByPackage: ReadableMap) {
    val map = mutableMapOf<String, Long>()
    val it = limitsMsByPackage.keySetIterator()
    while (it.hasNextKey()) {
      val key = it.nextKey()
      val v = limitsMsByPackage.getDouble(key).toLong()
      if (v > 0) map[key] = v
    }
    RulesStore.setDailyLimitsMs(reactContext, map)
  }

  @ReactMethod
  fun getDailyLimitsMs(promise: Promise) {
    val obj = RulesStore.getDailyLimitsMs(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      map.putDouble(k, obj.optLong(k, 0L).toDouble())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun setKeywords(keywords: ReadableArray) {
    val list = mutableListOf<String>()
    for (i in 0 until keywords.size()) {
      val v = keywords.getString(i)
      if (v != null) list.add(v)
    }
    RulesStore.setKeywords(reactContext, list)
  }

  @ReactMethod
  fun getKeywords(promise: Promise) {
    val list = RulesStore.getKeywords(reactContext)
    val arr = com.facebook.react.bridge.Arguments.createArray()
    list.forEach { arr.pushString(it) }
    promise.resolve(arr)
  }

  @ReactMethod
  fun getTodayUsageMs(promise: Promise) {
    val obj = AppUsageStore.getTodayUsageMs(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      map.putDouble(k, obj.optLong(k, 0L).toDouble())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun clearAllUsage(promise: Promise) {
    AppUsageStore.clearAll(reactContext)
    promise.resolve(true)
  }

  @ReactMethod
  fun getLastForeground(promise: Promise) {
    val (pkg, ts) = LastForegroundStore.get(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    map.putString("packageName", pkg)
    map.putDouble("timestampMs", ts.toDouble())
    promise.resolve(map)
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    reactContext.startActivity(UsageStatsReader.openUsageAccessSettingsIntent())
  }

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    promise.resolve(UsageStatsReader.hasUsageAccess(reactContext))
  }

  @ReactMethod
  fun getTodayUsageMsUsageStats(promise: Promise) {
    val obj = UsageStatsReader.getTodayUsageMs(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      map.putDouble(k, obj.optLong(k, 0L).toDouble())
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun getCurrentForegroundPackage(promise: Promise) {
    promise.resolve(UsageStatsReader.getCurrentForegroundPackage(reactContext))
  }

  @ReactMethod
  fun getUsageAccessDebug(promise: Promise) {
    val obj = UsageStatsReader.usageAccessDebug(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      val v = obj.opt(k)
      when (v) {
        is Number -> map.putDouble(k, v.toDouble())
        else -> map.putString(k, v?.toString() ?: "")
      }
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun getAccessibilityServiceHealth(promise: Promise) {
    val (msg, ts) = ServiceHealthStore.getAccessibilityError(reactContext)
    val (lastEventTs, eventCount) = ServiceHealthStore.getAccessibilityHeartbeat(reactContext)
    val now = System.currentTimeMillis()
    val map = com.facebook.react.bridge.Arguments.createMap()
    map.putString("lastError", msg)
    map.putDouble("lastErrorTsMs", ts.toDouble())
    map.putDouble("lastAccessibilityEventTsMs", lastEventTs.toDouble())
    map.putDouble("accessibilityEventCount", eventCount.toDouble())
    map.putDouble(
      "accessibilityStaleMs",
      if (lastEventTs > 0L) (now - lastEventTs).toDouble() else -1.0,
    )
    promise.resolve(map)
  }

  /**
   * Call from JS after device bind (or on app start) so background jobs can POST without reading RN storage.
   */
  @ReactMethod
  fun setLinkedTrackId(trackId: String, promise: Promise) {
    try {
      val v = trackId.trim()
      if (v.isNotBlank()) {
        DeviceLinkStore.setTrackId(reactContext, v)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_TRACK", e.message, e)
    }
  }

  @ReactMethod
  fun getLastActivitiesSyncMs(promise: Promise) {
    promise.resolve(ActivitySyncStore.getLastSyncMs(reactContext).toDouble())
  }

  @ReactMethod
  fun setLastActivitiesSyncMs(tsMs: Double, promise: Promise) {
    try {
      val v = tsMs.toLong()
      if (v > 0L) {
        ActivitySyncStore.setLastSyncMs(reactContext, v)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SYNC", e.message, e)
    }
  }

  @ReactMethod
  fun getLastLocationSyncMs(promise: Promise) {
    promise.resolve(ActivitySyncStore.getLastLocationSyncMs(reactContext).toDouble())
  }

  @ReactMethod
  fun setLastLocationSyncMs(tsMs: Double, promise: Promise) {
    try {
      val v = tsMs.toLong()
      if (v > 0L) {
        ActivitySyncStore.setLastLocationSyncMs(reactContext, v)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_LOC_SYNC", e.message, e)
    }
  }

  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    try {
      val fineGranted =
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
          PackageManager.PERMISSION_GRANTED
      val coarseGranted =
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
          PackageManager.PERMISSION_GRANTED
      if (!fineGranted && !coarseGranted) {
        promise.reject("E_LOCATION_PERMISSION", "Location permission not granted")
        return
      }

      val lm = reactContext.getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager
      val locationEnabled =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          lm.isLocationEnabled
        } else {
          @Suppress("DEPRECATION")
          lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ||
            lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)
        }
      if (!locationEnabled) {
        promise.reject("E_LOCATION_DISABLED", "Location services are disabled")
        return
      }

      val client = LocationServices.getFusedLocationProviderClient(reactContext)
      val cts = CancellationTokenSource()
      val priority =
        if (fineGranted) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
      val location = Tasks.await(client.getCurrentLocation(priority, cts.token), 12, java.util.concurrent.TimeUnit.SECONDS)
      if (location == null) {
        promise.reject("E_LOCATION_UNAVAILABLE", "Could not fetch current location")
        return
      }

      val map = com.facebook.react.bridge.Arguments.createMap()
      map.putDouble("latitude", location.latitude)
      map.putDouble("longitude", location.longitude)
      map.putDouble("accuracy", location.accuracy.toDouble())
      map.putDouble("timestampMs", location.time.toDouble())
      map.putString("provider", location.provider ?: "fused")
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_LOCATION_FETCH", e.message, e)
    }
  }
}

