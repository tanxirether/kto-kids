import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import instance from "../api/api_instance";

const { DeviceAccessModule } = NativeModules;

const LAST_SYNC_STORAGE_KEY = "last_activities_sync_ms";
const LAST_LOCATION_SYNC_STORAGE_KEY = "last_location_sync_ms";
const ACTIVITY_CONTEXT_STORAGE_KEY = "activity_context_by_package_v1";
const BROWSER_CONTEXT_KEY = "__browser__";
let inMemoryActivityContext = null;

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

const PACKAGE_APP_NAME_MAP = {
  "com.android.chrome": "Chrome",
  "com.google.android.youtube": "YouTube",
  "com.whatsapp": "WhatsApp",
  "com.instagram.android": "Instagram",
  "com.facebook.katana": "Facebook",
  "com.zhiliaoapp.musically": "TikTok",
  "org.telegram.messenger": "Telegram",
  "com.snapchat.android": "Snapchat",
  "com.android.vending": "Play Store",
  "com.google.android.gm": "Gmail",
};

function toTitleCaseWords(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferAppNameFromPackage(packageName) {
  const pkg = String(packageName || "").trim();
  if (!pkg) return "";
  if (PACKAGE_APP_NAME_MAP[pkg]) return PACKAGE_APP_NAME_MAP[pkg];
  const lastSegment = pkg.split(".").pop() || pkg;
  const cleaned = lastSegment.replace(/[_-]+/g, " ").replace(/\d+/g, " ").trim();
  if (!cleaned) return pkg;
  return toTitleCaseWords(cleaned);
}

function sanitizeKeyword(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, " ");
}

function sanitizeSnippet(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").slice(0, 120);
}

function parseKeywordsCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => sanitizeKeyword(s))
    .filter(Boolean);
}

function mergeKeywordsCsv(prevCsv, nextKeyword, maxItems = 8) {
  const merged = [...parseKeywordsCsv(prevCsv), ...parseKeywordsCsv(nextKeyword)];
  if (merged.length === 0) return "";
  const seen = new Set();
  const out = [];
  for (const kw of merged) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length >= maxItems) break;
  }
  return out.join(", ");
}

function extractWebsiteFromText(text) {
  const source = String(text || "").trim();
  if (!source) return "";
  const urlMatch = source.match(/\bhttps?:\/\/([a-z0-9-]+\.)+[a-z]{2,}[^\s)]+/i);
  if (urlMatch && urlMatch[0]) {
    const full = urlMatch[0].replace(/[),.;!?]+$/, "");
    const hostMatch = full.match(/https?:\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})/i);
    if (hostMatch && hostMatch[1]) return hostMatch[1].toLowerCase();
  }
  const domainMatch = source.toLowerCase().match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/);
  return domainMatch ? domainMatch[0] : "";
}

function deriveBrowsingKeyword(event) {
  const explicit = sanitizeKeyword(event?.keyword);
  if (explicit) return explicit;

  // Fallback to snippet text (search phrase/content) when native keyword is absent.
  const snippet = sanitizeSnippet(event?.snippet);
  if (!snippet) return "";
  const website = extractWebsiteFromText(snippet);
  const withoutLink = website
    ? snippet.replace(new RegExp(website.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    : snippet;
  return sanitizeSnippet(withoutLink);
}

async function getActivityContextByPackage() {
  if (inMemoryActivityContext && typeof inMemoryActivityContext === "object") {
    return inMemoryActivityContext;
  }
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_CONTEXT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    inMemoryActivityContext = parsed && typeof parsed === "object" ? parsed : {};
    return inMemoryActivityContext;
  } catch {
    return {};
  }
}

function isBrowserLikePackage(packageName) {
  const pkg = String(packageName || "").toLowerCase();
  if (!pkg) return false;
  return (
    pkg.includes("chrome") ||
    pkg.includes("browser") ||
    pkg.includes("quicksearch") ||
    pkg.includes("webview") ||
    pkg.includes("youtube")
  );
}

/**
 * Save latest website/keyword hints from native KeywordDetected events.
 * These values are attached to /activities payloads by package name.
 */
export async function recordKeywordActivityContext(event) {
  try {
    const packageName = String(event?.packageName || "").trim();
    if (!packageName) return;
    const keyword = deriveBrowsingKeyword(event);
    const website = sanitizeSnippet(event?.website || event?.url) || extractWebsiteFromText(event?.snippet);
    if (!keyword && !website) return;

    const byPackage = await getActivityContextByPackage();
    const prev = byPackage[packageName] && typeof byPackage[packageName] === "object" ? byPackage[packageName] : {};
    const nextKeywords = mergeKeywordsCsv(prev.keywords, keyword);
    byPackage[packageName] = {
      ...prev,
      packageName,
      website: website || String(prev.website || ""),
      keywords: nextKeywords || String(prev.keywords || ""),
      updatedAtMs: Date.now(),
    };
    if (isBrowserLikePackage(packageName)) {
      const prevBrowser =
        byPackage[BROWSER_CONTEXT_KEY] && typeof byPackage[BROWSER_CONTEXT_KEY] === "object"
          ? byPackage[BROWSER_CONTEXT_KEY]
          : {};
      byPackage[BROWSER_CONTEXT_KEY] = {
        ...prevBrowser,
        packageName: BROWSER_CONTEXT_KEY,
        website: website || String(prevBrowser.website || ""),
        keywords: mergeKeywordsCsv(prevBrowser.keywords, keyword),
        updatedAtMs: Date.now(),
      };
    }
    inMemoryActivityContext = byPackage;
    await AsyncStorage.setItem(ACTIVITY_CONTEXT_STORAGE_KEY, JSON.stringify(byPackage));
  } catch {
    // best effort
  }
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

  const contextByPackage = await getActivityContextByPackage();
  let uploaded = 0;
  for (const [packageName, durationMs] of entries) {
    const ownContext =
      contextByPackage && typeof contextByPackage[packageName] === "object"
        ? contextByPackage[packageName]
        : {};
    const browserFallback =
      isBrowserLikePackage(packageName) &&
      contextByPackage &&
      typeof contextByPackage[BROWSER_CONTEXT_KEY] === "object"
        ? contextByPackage[BROWSER_CONTEXT_KEY]
        : {};
    const context = ownContext.website || ownContext.keywords ? ownContext : browserFallback;
    const now = new Date();
    const activityDate = now.toISOString().slice(0, 10);
    const body = {
      trackId: String(trackId),
      appName: inferAppNameFromPackage(packageName),
      packageName: String(packageName || ""),
      website: String(context.website || ""),
      keywords: String(context.keywords || ""),
      durationMinutes: toDurationMinutes(durationMs),
      activityDate,
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
