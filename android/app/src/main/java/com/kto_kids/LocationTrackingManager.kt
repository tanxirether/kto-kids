package com.kto_kids

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationListener
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Continuous child-location tracking, run from MyAccessibilityService so it keeps working
 * while the screen is off / app is backgrounded (the accessibility service process is kept
 * alive by the OS, unlike a plain JS setInterval timer which OEM battery managers suspend).
 *
 * This is additive to MonitoringSyncJobService's 15-minute periodic fallback (the OS-enforced
 * floor for JobScheduler.setPeriodic); this path aims for near-live updates while the service
 * is alive.
 */
object LocationTrackingManager {
  private const val TAG = "LocationTrackingMgr"
  private const val UPDATE_INTERVAL_MS = 45_000L
  private const val MIN_UPDATE_INTERVAL_MS = 20_000L
  private const val MIN_DISPLACEMENT_METERS = 15f

  // Send at least this often even if stationary, so parent sees a fresh timestamp;
  // otherwise only send once moved past MIN_DISPLACEMENT_METERS.
  private const val HEARTBEAT_MS = 120_000L
  private const val MOVED_THRESHOLD_METERS = 10f

  private val LOCATION_PATHS =
    listOf(
      "https://api.kto.solutions/api/v1/locations",
      "https://api.kto.solutions/api/v1/monitoring/location",
      "https://api.kto.solutions/api/v1/location/update",
    )

  private var client: FusedLocationProviderClient? = null
  private var listener: LocationListener? = null
  private var executor: ExecutorService? = null
  private var lastSent: Location? = null
  private var lastSentAtMs: Long = 0L
  private var started = false

  @Synchronized
  fun start(context: Context) {
    if (started) return
    if (!hasLocationPermission(context)) {
      Log.w(TAG, "Skipping start; location permission not granted")
      return
    }

    val appContext = context.applicationContext
    val exec = Executors.newSingleThreadExecutor()
    executor = exec

    val request =
      LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
        .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
        .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_METERS)
        .build()

    val fused = LocationServices.getFusedLocationProviderClient(appContext)
    client = fused

    val cb = LocationListener { location -> onLocation(appContext, location) }
    listener = cb

    try {
      fused.requestLocationUpdates(request, exec, cb)
      started = true
      Log.d(TAG, "Continuous location tracking started")
    } catch (t: Throwable) {
      Log.e(TAG, "requestLocationUpdates failed: ${t.message}", t)
      started = false
    }
  }

  @Synchronized
  fun stop() {
    val fused = client
    val cb = listener
    if (fused != null && cb != null) {
      try {
        fused.removeLocationUpdates(cb)
      } catch (_: Throwable) {
      }
    }
    executor?.shutdown()
    executor = null
    client = null
    listener = null
    started = false
  }

  private fun hasLocationPermission(context: Context): Boolean {
    val fine =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarse =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  // Runs on the background executor (not the main thread), so network I/O here is safe.
  private fun onLocation(context: Context, location: Location) {
    try {
      val now = System.currentTimeMillis()
      val prev = lastSent
      val movedMeters = prev?.distanceTo(location) ?: Float.MAX_VALUE
      val dueForHeartbeat = now - lastSentAtMs >= HEARTBEAT_MS
      if (prev != null && movedMeters < MOVED_THRESHOLD_METERS && !dueForHeartbeat) {
        return
      }

      val trackId = TrackIdResolver.resolve(context)
      if (trackId.isBlank()) return

      val body =
        JSONObject()
          .put("trackId", trackId)
          .put("latitude", location.latitude)
          .put("longitude", location.longitude)
          .put("accuracy", location.accuracy.toDouble())
          .put("capturedAtMs", location.time)

      val ok = HttpJsonClient.postFirstSuccess(LOCATION_PATHS, body.toString())
      if (ok) {
        lastSent = location
        lastSentAtMs = now
        ActivitySyncStore.setLastLocationSyncMs(context, now)
        ActivitySyncStore.setLastSyncMs(context, now)
        Log.d(TAG, "Location uploaded (moved=${movedMeters}m, heartbeat=$dueForHeartbeat)")
      } else {
        Log.w(TAG, "Location upload failed for all endpoints")
      }
    } catch (t: Throwable) {
      Log.e(TAG, "onLocation failed: ${t.message}", t)
    }
  }
}
