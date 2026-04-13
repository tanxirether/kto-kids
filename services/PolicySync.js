import AsyncStorage from "@react-native-async-storage/async-storage";
import instance from "../api/api_instance";
import { applyMonitoringRules } from "./MonitoringRulesSync";

function normalizeStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((v) => v != null && String(v).trim() !== "").map((v) => String(v).trim());
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    } catch {
      // single string token
    }
    return [value.trim()];
  }
  return [];
}

function firstStringList(data, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const v = data[k];
    const n = normalizeStringArray(v);
    if (n.length > 0) return n;
  }
  return [];
}

function mergeDistinctKeywords(blockedKeywords, blockedWebsites) {
  const seen = new Set();
  const out = [];
  for (const s of [...blockedKeywords, ...blockedWebsites]) {
    const t = String(s).trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(t);
  }
  return out;
}

function normalizePolicyResponse(payload) {
  // Accept common shapes:
  // - { data: { blocked_apps: [...] } }
  // - { data: { blockedApps: [...] } }
  // - { blocked_apps: [...] }
  // - { blockedApps: [...] }
  const root = payload && typeof payload === "object" ? payload : {};
  const data = root.data && typeof root.data === "object" ? root.data : root;

  const blockedApps =
    data.blockedApps ??
    data.blocked_apps ??
    data.blockedPackages ??
    data.blocked_packages ??
    [];

  const blockedWebsites = mergeDistinctKeywords(
    firstStringList(data, ["blockedWebsites", "blocked_websites"]),
    firstStringList(data, ["blockedUrls", "blocked_urls"]),
  );

  const blockedKeywords = firstStringList(data, ["blockedKeywords", "blocked_keywords", "keywords"]);

  const keywords = mergeDistinctKeywords(blockedKeywords, blockedWebsites);

  const familyIdRaw =
    data.familyId ??
    data.family_id ??
    root.familyId ??
    root.family_id ??
    "";
  const familyId = String(familyIdRaw || "").trim();

  const appLimits = Array.isArray(data.app_limits)
    ? data.app_limits
    : Array.isArray(data.appLimits)
      ? data.appLimits
      : [];

  const limitsMsByPackage = {};
  appLimits.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const pkg = String(
      row.packageName ?? row.package_name ?? row.package ?? row.appPackage ?? "",
    ).trim();
    const minutes = Number(
      row.dailyLimitMinutes ?? row.daily_limit_minutes ?? row.limitMinutes ?? row.limit_minutes ?? 0,
    );
    if (!pkg || !Number.isFinite(minutes) || minutes <= 0) return;
    limitsMsByPackage[pkg] = Math.round(minutes * 60 * 1000);
  });

  return {
    blockedApps: Array.isArray(blockedApps) ? blockedApps.filter(Boolean).map(String) : [],
    blockedWebsites,
    blockedKeywords,
    keywords,
    familyId,
    limitsMsByPackage,
    isCameraBlocked:
      data.isCameraBlocked === true ||
      data.is_camera_blocked === true ||
      String(data.isCameraBlocked || data.is_camera_blocked).toLowerCase() === "true",
  };
}

async function fetchPolicy(trackId) {
  // Try multiple endpoints because backend implementations vary.
  // Prefer GET (no side effects).
  const candidates = [
    () => instance.get("/policies", { params: { trackId: String(trackId) } }),
    () => instance.get(`/policies/${encodeURIComponent(String(trackId))}`),
  ];

  let lastErr = null;
  for (const fn of candidates) {
    try {
      const res = await fn();
      return res?.data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Failed to fetch policy");
}

function shallowEqualArray(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Starts a simple polling loop to sync policy -> local enforcement.
 * Android enforcement is done by the Accessibility service.
 *
 * Returns a cleanup function.
 */
export function startPolicySync({ intervalMs = 20000 } = {}) {
  let stopped = false;
  let timer = null;
  let lastBlockedApps = null;
  let lastLimitsDigest = "";
  let lastCameraBlocked = null;
  let lastKeywordsDigest = "";

  async function tick() {
    if (stopped) return;
    try {
      const trackId = String((await AsyncStorage.getItem("trackid")) || "").trim();
      if (!trackId) return;

      const raw = await fetchPolicy(trackId);
      const policy = normalizePolicyResponse(raw);

      if (policy.familyId) {
        try {
          await AsyncStorage.setItem("familyId", policy.familyId);
        } catch {
          // ignore
        }
      }

      const blockedApps = policy.blockedApps;
      const limits = policy.limitsMsByPackage || {};
      const limitsDigest = JSON.stringify(limits);
      const cameraBlocked = policy.isCameraBlocked;
      const keywords = Array.isArray(policy.keywords) ? policy.keywords : [];
      const keywordsDigest = JSON.stringify(keywords);
      const blockedUnchanged = shallowEqualArray(blockedApps, lastBlockedApps);
      const limitsUnchanged = limitsDigest === lastLimitsDigest;
      const cameraUnchanged = cameraBlocked === lastCameraBlocked;
      const keywordsUnchanged = keywordsDigest === lastKeywordsDigest;
      if (blockedUnchanged && limitsUnchanged && cameraUnchanged && keywordsUnchanged) return;

      lastBlockedApps = blockedApps;
      lastLimitsDigest = limitsDigest;
      lastCameraBlocked = cameraBlocked;
      lastKeywordsDigest = keywordsDigest;
      await applyMonitoringRules({
        blockedPackages: blockedApps,
        limitsMsByPackage: limits,
        keywords,
      });
      // eslint-disable-next-line no-console
      console.log("PolicySync: rules applied", {
        blockedAppsCount: blockedApps.length,
        appLimitsCount: Object.keys(limits).length,
        isCameraBlocked: cameraBlocked,
        keywordsCount: keywords.length,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("PolicySync: fetch/apply failed:", e?.message || e);
    }
  }

  // kick immediately, then interval
  tick();
  timer = setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  };
}

