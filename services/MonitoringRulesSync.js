import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeAccessibilityEvents } from "./AccessibilityServiceBridge";
import { setDailyLimitsMs, setKeywords } from "./AccessibilityServiceBridge";

const STORAGE_KEY = "monitoring_rules_v1";

/**
 * Apply rules from backend/CMS.
 * Expected shape (example):
 * {
 *   limitsMsByPackage: { "com.instagram.android": 3600000 },
 *   keywords: ["porn", "slang1"]
 * }
 */
export async function applyMonitoringRules(rules) {
  if (!rules || typeof rules !== "object") return;
  try {
    if (rules.limitsMsByPackage) setDailyLimitsMs(rules.limitsMsByPackage);
    if (Array.isArray(rules.keywords)) setKeywords(rules.keywords);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("applyMonitoringRules failed", e);
  }
}

export async function restoreMonitoringRules() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    await applyMonitoringRules(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Simple listener hook you can replace with backend logging.
 */
export function subscribeMonitoringEvents({ onForegroundEvent, onKeywordDetected } = {}) {
  const sub1 = subscribeAccessibilityEvents(onForegroundEvent || (() => {}));

  // KeywordDetected is a native->JS event; use DeviceEventEmitter (same emitter) via NativeEventEmitter
  // For simplicity, reuse the same emitter instance by subscribing to AccessibilityEventDetected is enough
  // if you just want package changes. Keyword events are emitted separately.
  // eslint-disable-next-line global-require
  const { NativeEventEmitter, NativeModules } = require("react-native");
  const emitter = new NativeEventEmitter(NativeModules.DeviceAccessModule);
  const sub2 = emitter.addListener("KeywordDetected", onKeywordDetected || (() => {}));

  return () => {
    sub1.remove();
    sub2.remove();
  };
}

