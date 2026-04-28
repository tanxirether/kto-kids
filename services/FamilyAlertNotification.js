import AsyncStorage from "@react-native-async-storage/async-storage";
import instance from "../api/api_instance";

const LAST_SEND_MS_KEY = "family_alert_last_send_ms";
const MIN_INTERVAL_MS = 120_000;
const AUTH_TOKEN_KEYS = [
  "accessToken",
  "access_token",
  "token",
  "authToken",
  "auth_token",
  "jwt",
  "user",
  "session",
];

function tryExtractToken(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return (
          String(
            parsed?.accessToken ||
              parsed?.access_token ||
              parsed?.token ||
              parsed?.authToken ||
              parsed?.jwt ||
              "",
          ).trim()
        );
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value === "object") {
    return String(
      value?.accessToken ||
        value?.access_token ||
        value?.token ||
        value?.authToken ||
        value?.jwt ||
        "",
    ).trim();
  }
  return "";
}

async function getAuthorizationHeader() {
  for (const key of AUTH_TOKEN_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(key);
      const token = tryExtractToken(raw);
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // ignore
    }
  }
  return {};
}

/**
 * Notify parents when policy-driven keyword / website rules match (native KeywordDetected).
 * Uses family id from policy storage when present, otherwise track id from pairing.
 */
export async function sendFamilyActivityAlert() {
  try {
    const now = Date.now();
    const lastRaw = await AsyncStorage.getItem(LAST_SEND_MS_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && now - last < MIN_INTERVAL_MS) return;

    const authHeaders = await getAuthorizationHeader();
    await instance.post(
      "/notifications/send",
      {
        title: "Alert",
        message: "Your child was searching 18+ tags.",
        targetAudience: {
          type: "all",
        },
      },
      { headers: authHeaders },
    );
    // eslint-disable-next-line no-console
    console.log("FamilyAlertNotification: send success", { type: "all" });
    await AsyncStorage.setItem(LAST_SEND_MS_KEY, String(now));
  } catch (e) {
    // eslint-disable-next-line no-console
    const serverMessage =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.response?.statusText ||
      e?.message ||
      e;
    console.warn("FamilyAlertNotification: send failed", serverMessage);
  }
}
