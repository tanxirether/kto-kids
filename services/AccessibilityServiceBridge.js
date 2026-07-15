import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import { getLastActivitiesSyncMsFromStorage, getLastLocationSyncMsFromStorage } from "./MonitoringSnapshotService";

const { DeviceAccessModule } = NativeModules;

const emitter = new NativeEventEmitter();

export function openAccessibilitySettings() {
  if (Platform.OS !== "android") return;
  DeviceAccessModule?.openAccessibilitySettings?.();
}

export async function isAccessibilityEnabled() {
  if (Platform.OS !== "android") return false;
  if (!DeviceAccessModule?.isAccessibilityEnabled) return false;
  return await DeviceAccessModule.isAccessibilityEnabled();
}

export function subscribeAccessibilityEvents(callback) {
  if (Platform.OS !== "android") return { remove: () => {} };
  return emitter.addListener("AccessibilityEventDetected", callback);
}

export function setBlockedPackages(packages) {
  if (Platform.OS !== "android") return;
  if (!Array.isArray(packages)) return;
  DeviceAccessModule?.setBlockedPackages?.(packages);
}

export async function getBlockedPackages() {
  if (Platform.OS !== "android") return [];
  if (!DeviceAccessModule?.getBlockedPackages) return [];
  return await DeviceAccessModule.getBlockedPackages();
}

export function setDailyLimitsMs(limitsMsByPackage) {
  if (Platform.OS !== "android") return;
  if (!limitsMsByPackage || typeof limitsMsByPackage !== "object") return;
  DeviceAccessModule?.setDailyLimitsMs?.(limitsMsByPackage);
}

export async function getDailyLimitsMs() {
  if (Platform.OS !== "android") return {};
  if (!DeviceAccessModule?.getDailyLimitsMs) return {};
  return await DeviceAccessModule.getDailyLimitsMs();
}

export function setKeywords(keywords) {
  if (Platform.OS !== "android") return;
  if (!Array.isArray(keywords)) return;
  DeviceAccessModule?.setKeywords?.(keywords);
}

export async function getKeywords() {
  if (Platform.OS !== "android") return [];
  if (!DeviceAccessModule?.getKeywords) return [];
  return await DeviceAccessModule.getKeywords();
}

export async function getTodayUsageMs() {
  if (Platform.OS !== "android") return {};
  if (!DeviceAccessModule?.getTodayUsageMs) return {};
  return await DeviceAccessModule.getTodayUsageMs();
}

export async function clearAllUsage() {
  if (Platform.OS !== "android") return false;
  if (!DeviceAccessModule?.clearAllUsage) return false;
  return await DeviceAccessModule.clearAllUsage();
}

export async function getLastForeground() {
  if (Platform.OS !== "android") return { packageName: "", timestampMs: 0 };
  if (!DeviceAccessModule?.getLastForeground) return { packageName: "", timestampMs: 0 };
  return await DeviceAccessModule.getLastForeground();
}

export function openUsageAccessSettings() {
  if (Platform.OS !== "android") return;
  DeviceAccessModule?.openUsageAccessSettings?.();
}

export async function hasUsageAccess() {
  if (Platform.OS !== "android") return false;
  if (!DeviceAccessModule?.hasUsageAccess) return false;
  return await DeviceAccessModule.hasUsageAccess();
}

export async function getTodayUsageMsUsageStats() {
  if (Platform.OS !== "android") return {};
  if (!DeviceAccessModule?.getTodayUsageMsUsageStats) return {};
  return await DeviceAccessModule.getTodayUsageMsUsageStats();
}

export async function getCurrentForegroundPackage() {
  if (Platform.OS !== "android") return "";
  if (!DeviceAccessModule?.getCurrentForegroundPackage) return "";
  return await DeviceAccessModule.getCurrentForegroundPackage();
}

export async function getUsageAccessDebug() {
  if (Platform.OS !== "android") return {};
  if (!DeviceAccessModule?.getUsageAccessDebug) return {};
  return await DeviceAccessModule.getUsageAccessDebug();
}

export async function getLastActivitiesSyncMs() {
  if (Platform.OS !== "android") return 0;
  if (!DeviceAccessModule?.getLastActivitiesSyncMs) return 0;
  const v = await DeviceAccessModule.getLastActivitiesSyncMs();
  return typeof v === "number" ? v : 0;
}

export async function getLastLocationSyncMs() {
  if (Platform.OS !== "android") return 0;
  if (!DeviceAccessModule?.getLastLocationSyncMs) return 0;
  const v = await DeviceAccessModule.getLastLocationSyncMs();
  return typeof v === "number" ? v : 0;
}

/** Max of native prefs + JS AsyncStorage (covers FCM path vs background job). */
export async function getLastActivitiesSyncMsMerged() {
  const [nativeMs, storageMs] = await Promise.all([
    getLastActivitiesSyncMs().catch(() => 0),
    getLastActivitiesSyncMsFromStorage().catch(() => 0),
  ]);
  const a = typeof nativeMs === "number" ? nativeMs : 0;
  const b = typeof storageMs === "number" ? storageMs : 0;
  return Math.max(a, b);
}

/** Max of native prefs + JS AsyncStorage for location uploads. */
export async function getLastLocationSyncMsMerged() {
  const [nativeMs, storageMs] = await Promise.all([
    getLastLocationSyncMs().catch(() => 0),
    getLastLocationSyncMsFromStorage().catch(() => 0),
  ]);
  const a = typeof nativeMs === "number" ? nativeMs : 0;
  const b = typeof storageMs === "number" ? storageMs : 0;
  return Math.max(a, b);
}

export function setLinkedTrackId(trackId) {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!DeviceAccessModule?.setLinkedTrackId) return Promise.resolve();
  return DeviceAccessModule.setLinkedTrackId(String(trackId || ""));
}

export async function getAccessibilityServiceHealth() {
  if (Platform.OS !== "android") {
    return {
      lastError: "",
      lastErrorTsMs: 0,
      lastAccessibilityEventTsMs: 0,
      accessibilityEventCount: 0,
      accessibilityStaleMs: -1,
    };
  }
  if (!DeviceAccessModule?.getAccessibilityServiceHealth) {
    return {
      lastError: "",
      lastErrorTsMs: 0,
      lastAccessibilityEventTsMs: 0,
      accessibilityEventCount: 0,
      accessibilityStaleMs: -1,
    };
  }
  return await DeviceAccessModule.getAccessibilityServiceHealth();
}

export async function getCurrentLocation() {
  if (Platform.OS !== "android") return null;
  if (!DeviceAccessModule?.getCurrentLocation) return null;
  return await DeviceAccessModule.getCurrentLocation();
}

/** True if device Location / GPS is turned on (system location services). */
export async function isDeviceLocationEnabled() {
  if (Platform.OS !== "android") return true;
  if (!DeviceAccessModule?.isLocationEnabled) return true;
  try {
    return Boolean(await DeviceAccessModule.isLocationEnabled());
  } catch {
    return true;
  }
}

/** Open Android Location settings (turn GPS / Location on). */
export function openDeviceLocationSettings() {
  if (Platform.OS !== "android") return;
  if (DeviceAccessModule?.openLocationSettings) {
    DeviceAccessModule.openLocationSettings();
    return;
  }
}

/**
 * Prompt user to turn on device Location/GPS (system dialog when possible).
 * Returns true only when location services are actually enabled.
 */
export async function ensureDeviceLocationEnabled() {
  if (Platform.OS !== "android") return true;
  if (DeviceAccessModule?.ensureDeviceLocationEnabled) {
    try {
      return Boolean(await DeviceAccessModule.ensureDeviceLocationEnabled());
    } catch {
      openDeviceLocationSettings();
      return false;
    }
  }
  const on = await isDeviceLocationEnabled();
  if (!on) openDeviceLocationSettings();
  return on;
}

