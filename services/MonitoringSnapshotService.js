import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import instance from "../api/api_instance";

const { DeviceAccessModule } = NativeModules;

const LAST_SYNC_STORAGE_KEY = "last_activities_sync_ms";
const LAST_LOCATION_SYNC_STORAGE_KEY = "last_location_sync_ms";

/** Call after any successful /activities or snapshot upload so UI can show "Last activities sync". */
export async function recordActivitiesSyncSuccess() {
  const now = Date.now();
  try {
    await AsyncStorage.setItem(LAST_SYNC_STORAGE_KEY, String(now));
  } catch {
    // best effort
  }
  if (Platform.OS !== "android" || !DeviceAccessModule?.setLastActivitiesSyncMs) return;
  try {
    await DeviceAccessModule.setLastActivitiesSyncMs(now);
  } catch {
    // best effort
  }
}

export async function getLastActivitiesSyncMsFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function recordLocationSyncSuccess() {
  const now = Date.now();
  try {
    await AsyncStorage.setItem(LAST_LOCATION_SYNC_STORAGE_KEY, String(now));
  } catch {
    // best effort
  }
  if (Platform.OS !== "android" || !DeviceAccessModule?.setLastLocationSyncMs) return;
  try {
    await DeviceAccessModule.setLastLocationSyncMs(now);
  } catch {
    // best effort
  }
}

export async function getLastLocationSyncMsFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOCATION_SYNC_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function parseJsonMaybe(raw, fallback) {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function toDurationMinutes(durationMs) {
  const minutes = Math.round(Number(durationMs || 0) / 60000);
  return Math.max(0, minutes);
}

async function uploadActivities(trackId, usageByPackage) {
  const baseURL = instance.defaults.baseURL || "https://api.kto.solutions/api/v1";
  const candidates = [
    `${baseURL}/activities`,
    `${baseURL}/monitoring/activities`,
    `${baseURL}/usage/activities`,
  ];

  const entries = Object.entries(usageByPackage || {});
  if (entries.length === 0) return { ok: true, uploaded: 0 };

  let uploaded = 0;
  for (const [packageName, durationMs] of entries) {
    const body = {
      trackId: String(trackId),
      appName: String(packageName || ""),
      packageName: String(packageName || ""),
      durationMinutes: toDurationMinutes(durationMs),
    };
    if (!body.packageName || body.durationMinutes <= 0) continue;

    let lastError = null;
    let sent = false;
    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Upload failed: ${response.status} - ${text || response.statusText}`);
        }
        sent = true;
        uploaded += 1;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!sent && lastError) {
      throw lastError;
    }
  }

  if (uploaded > 0) {
    await recordActivitiesSyncSuccess();
  }
  return { ok: true, uploaded };
}

/**
 * Upload a usage snapshot so parent can see data without child UI being open.
 * Tries multiple endpoints for backend compatibility.
 */
export async function uploadMonitoringSnapshot(snapshot) {
  const trackId = String((await AsyncStorage.getItem("trackid")) || "").trim();
  if (!trackId) {
    throw new Error("No track ID found - device may not be linked");
  }

  const parsedSnapshot = parseJsonMaybe(snapshot, {});
  const usageByPackage = parsedSnapshot?.usageByPackage;
  const isUsageSnapshot =
    usageByPackage &&
    typeof usageByPackage === "object" &&
    !Array.isArray(usageByPackage) &&
    parsedSnapshot?.kind !== "health";

  if (isUsageSnapshot) {
    const result = await uploadActivities(trackId, usageByPackage);
    console.log(
      `Activities uploaded (trackId=${trackId}, count=${result?.uploaded || 0})`,
    );
    return result;
  }

  const payload = {
    trackId: String(trackId),
    snapshot: parsedSnapshot,
    capturedAtMs: Date.now(),
  };

  const baseURL = instance.defaults.baseURL || "https://api.kto.solutions/api/v1";
  const candidates = [
    `${baseURL}/monitoring/usage-snapshot`,
    `${baseURL}/usage/snapshot`,
    `${baseURL}/monitoring/snapshot`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${text || response.statusText}`);
      }
      await recordActivitiesSyncSuccess();
      return await response.json().catch(() => ({ ok: true }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Monitoring snapshot upload failed");
}
