import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import instance from "../api/api_instance";
import { getCurrentLocation } from "./AccessibilityServiceBridge";
import { recordActivitiesSyncSuccess, recordLocationSyncSuccess } from "./MonitoringSnapshotService";

const FOREGROUND_INTERVAL_MS = 60 * 1000;
const BACKGROUND_INTERVAL_MS = 5 * 60 * 1000;

let stopped = false;
let timer = null;
let inFlight = false;
let lastSent = null;
let appStateSub = null;
let currentIntervalMs = FOREGROUND_INTERVAL_MS;

function sameAsLast(last, next) {
  if (!last || !next) return false;
  const latDelta = Math.abs(Number(last.latitude || 0) - Number(next.latitude || 0));
  const lngDelta = Math.abs(Number(last.longitude || 0) - Number(next.longitude || 0));
  return latDelta < 0.00005 && lngDelta < 0.00005;
}

async function uploadLocation(trackId, location) {
  const payload = {
    trackId: String(trackId),
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracy: Number(location.accuracy || 0),
    capturedAtMs: Number(location.timestampMs || Date.now()),
  };
  const baseURL = instance.defaults.baseURL || "https://api.kto.solutions/api/v1";
  const candidates = [
    `${baseURL}/locations`,
    `${baseURL}/monitoring/location`,
    `${baseURL}/location/update`,
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
      await recordLocationSyncSuccess();
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Location upload failed");
}

async function tick() {
  if (stopped || inFlight || Platform.OS !== "android") return;
  inFlight = true;
  try {
    const trackId = String((await AsyncStorage.getItem("trackid")) || "").trim();
    if (!trackId) return;
    const location = await getCurrentLocation().catch(() => null);
    if (!location || typeof location !== "object") return;
    if (sameAsLast(lastSent, location)) return;
    await uploadLocation(trackId, location);
    lastSent = location;
    console.log("LocationSync: location uploaded");
  } catch (e) {
    console.warn("LocationSync: tick failed:", e?.message || e);
  } finally {
    inFlight = false;
  }
}

export async function syncLocationNow({ force = false } = {}) {
  if (Platform.OS !== "android") return false;
  const trackId = String((await AsyncStorage.getItem("trackid")) || "").trim();
  if (!trackId) return false;
  const location = await getCurrentLocation().catch(() => null);
  if (!location || typeof location !== "object") return false;
  if (!force && sameAsLast(lastSent, location)) return false;
  await uploadLocation(trackId, location);
  lastSent = location;
  return true;
}

function restartTimer(intervalMs) {
  if (timer) clearInterval(timer);
  currentIntervalMs = intervalMs;
  timer = setInterval(tick, currentIntervalMs);
}

export function startLocationSync() {
  if (Platform.OS !== "android") return () => {};
  stopped = false;
  tick();
  restartTimer(FOREGROUND_INTERVAL_MS);

  appStateSub = AppState.addEventListener("change", (state) => {
    const target = state === "active" ? FOREGROUND_INTERVAL_MS : BACKGROUND_INTERVAL_MS;
    if (target !== currentIntervalMs) restartTimer(target);
    if (state === "active") tick();
  });

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
    appStateSub?.remove?.();
    appStateSub = null;
  };
}

