/**
 * Global FCM command handler - works on ANY screen and when app is backgrounded.
 * Foreground: captures via ViewShot (or native ScreenshotModule if available).
 * Background: sets pending flag + shows notification; when app opens we capture and upload.
 */
import { NativeModules, Alert, Platform } from 'react-native';
import { showScreenshotRequestNotification, showCameraCaptureRequestNotification } from './ScreenshotNotificationService';
import { setPending as setPendingScreenshot } from './PendingScreenshotManager';
import { applyMonitoringRules } from './MonitoringRulesSync';
import { uploadMonitoringSnapshot } from './MonitoringSnapshotService';
import { wasCommandHandled } from './CommandDedupStore';
import {
  getAccessibilityServiceHealth,
  getCurrentForegroundPackage,
  getLastForeground,
  getTodayUsageMs,
  getTodayUsageMsUsageStats,
  getUsageAccessDebug,
  hasUsageAccess,
  isAccessibilityEnabled,
} from './AccessibilityServiceBridge';

// Flag for ForegroundServiceManager - don't start service during screenshot (prevents activity destruction)
let _screenshotInProgress = false;
export function isScreenshotInProgress() {
  return _screenshotInProgress;
}
export function setScreenshotInProgress(v) {
  _screenshotInProgress = v;
}
import { uploadScreenshot } from './ScreenshotService';
import { getViewShotCapture } from './ScreenshotCaptureRegistry';
import { getCameraCaptureHandler } from './CameraCaptureRegistry';
import { setPending as setPendingCameraCapture } from './PendingCameraCaptureManager';
import { syncLocationNow } from './LocationSyncService';
import { getScreenShareState, startScreenShare, stopScreenShare } from './ScreenShareService';

const { ScreenshotModule, ScreenLock } = NativeModules;

function normalizeCommandName(rawCommand) {
  return String(rawCommand || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function getIncomingCommand(data = {}) {
  const direct = data?.command ?? data?.action ?? data?.type ?? '';
  return normalizeCommandName(direct);
}

function getCommandId(remoteMessage) {
  const data = remoteMessage?.data || {};
  return (
    data.commandId ||
    data.cmdId ||
    data.id ||
    remoteMessage?.messageId ||
    remoteMessage?.message_id ||
    ''
  );
}

function shouldBypassDedup(data = {}) {
  const retry = String(data.retry || '').toLowerCase();
  const force = String(data.force || '').toLowerCase();
  return retry === 'true' || force === 'true' || retry === '1' || force === '1';
}

function parseJsonMaybe(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mergeKeywordPayload(data) {
  const limitsMsByPackage = parseJsonMaybe(data?.limitsMsByPackage, null);
  const blockedPackages = parseJsonMaybe(data?.blockedPackages, null);
  const rawKeywords = parseJsonMaybe(data?.keywords, null);
  const blockedKeywords = parseJsonMaybe(data?.blockedKeywords ?? data?.blocked_keywords, null);
  const blockedWebsites = parseJsonMaybe(data?.blockedWebsites ?? data?.blocked_websites, null);
  const blockedUrls = parseJsonMaybe(data?.blockedUrls ?? data?.blocked_urls, null);

  const parts = [];
  if (Array.isArray(rawKeywords)) parts.push(...rawKeywords);
  if (Array.isArray(blockedKeywords)) parts.push(...blockedKeywords);
  if (Array.isArray(blockedWebsites)) parts.push(...blockedWebsites);
  if (Array.isArray(blockedUrls)) parts.push(...blockedUrls);

  let keywords = null;
  if (parts.length > 0) {
    const seen = new Set();
    keywords = [];
    for (const s of parts) {
      const t = String(s || '').trim();
      if (!t) continue;
      const low = t.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      keywords.push(t);
    }
  }

  return {
    ...(limitsMsByPackage && typeof limitsMsByPackage === 'object' ? { limitsMsByPackage } : {}),
    ...(Array.isArray(keywords) ? { keywords } : {}),
    ...(Array.isArray(blockedPackages) ? { blockedPackages } : {}),
  };
}

function extractRulesFromData(data) {
  const rulesObject = parseJsonMaybe(data?.rules, null);
  if (rulesObject && typeof rulesObject === 'object') return rulesObject;

  return mergeKeywordPayload(data);
}

async function handleRulesUpdate(data, options = {}) {
  const { isBackground = false } = options;
  const rules = extractRulesFromData(data);
  if (!rules || Object.keys(rules).length === 0) {
    console.warn('FCMCommandHandler: rules update command has no rule payload');
    return;
  }

  await applyMonitoringRules(rules);
  console.log('FCMCommandHandler: monitoring rules applied');

  if (!isBackground && Alert?.alert) {
    Alert.alert('Notice', 'Monitoring rules updated by parent.');
  }
}

/** Same source as Usage Debug "Today usage" when Usage Access is granted (UsageStats). */
async function getUsageForSnapshot() {
  const ua = await hasUsageAccess().catch(() => false);
  if (ua) {
    const stats = await getTodayUsageMsUsageStats().catch(() => ({}));
    if (stats && typeof stats === 'object' && Object.keys(stats).length > 0) {
      return stats;
    }
  }
  return getTodayUsageMs().catch(() => ({}));
}

async function buildUsageSnapshot(data = {}) {
  const includeDebug = String(data?.includeDebug || '').toLowerCase() === 'true';
  const [usageByPackage, lastForeground, currentForeground, usageAccess, accessibilityEnabled, usageDebug] =
    await Promise.all([
      getUsageForSnapshot(),
      getLastForeground().catch(() => ({ packageName: '', timestampMs: 0 })),
      getCurrentForegroundPackage().catch(() => ''),
      hasUsageAccess().catch(() => false),
      isAccessibilityEnabled().catch(() => false),
      includeDebug ? getUsageAccessDebug().catch(() => ({})) : Promise.resolve({}),
    ]);

  return {
    usageByPackage,
    lastForeground,
    currentForegroundPackage: currentForeground,
    hasUsageAccess: usageAccess,
    isAccessibilityEnabled: accessibilityEnabled,
    usageDebug,
  };
}

async function buildHealthSnapshot(data = {}) {
  const includeUsage = String(data?.includeUsage || '').toLowerCase() === 'true';
  const [usageAccess, accessibilityEnabled, accessibilityServiceHealth, lastForeground] =
    await Promise.all([
      hasUsageAccess().catch(() => false),
      isAccessibilityEnabled().catch(() => false),
      getAccessibilityServiceHealth().catch(() => ({
        lastError: '',
        lastErrorTsMs: 0,
        lastAccessibilityEventTsMs: 0,
        accessibilityEventCount: 0,
        accessibilityStaleMs: -1,
      })),
      getLastForeground().catch(() => ({ packageName: '', timestampMs: 0 })),
    ]);

  const health = {
    hasUsageAccess: usageAccess,
    isAccessibilityEnabled: accessibilityEnabled,
    accessibilityServiceHealth,
    lastForeground,
    checkedAtMs: Date.now(),
  };

  if (includeUsage) {
    health.usageByPackage = await getUsageForSnapshot();
  }
  return health;
}

async function handleUsageSnapshotRequest(data, options = {}) {
  const { isBackground = false } = options;
  const snapshot = await buildUsageSnapshot(data);
  await uploadMonitoringSnapshot(snapshot);
  console.log('FCMCommandHandler: usage snapshot uploaded');

  if (!isBackground && Alert?.alert) {
    Alert.alert('Notice', 'Usage snapshot sent to parent.');
  }
}

async function handleHealthSnapshotRequest(data, options = {}) {
  const { isBackground = false } = options;
  const snapshot = await buildHealthSnapshot(data);
  await uploadMonitoringSnapshot({ kind: 'health', ...snapshot });
  console.log('FCMCommandHandler: health snapshot uploaded');

  if (!isBackground && Alert?.alert) {
    Alert.alert('Notice', 'Device health snapshot sent to parent.');
  }
}

async function handleLocationRequest(data, options = {}) {
  const { isBackground = false } = options;
  const force = String(data?.force || '').toLowerCase() === 'true' || String(data?.force || '') === '1';
  try {
    const uploaded = await syncLocationNow({ force });
    if (!uploaded) {
      console.warn('FCMCommandHandler: location request skipped (no trackId/permission/location)');
      return;
    }
    console.log('FCMCommandHandler: location uploaded');
    if (!isBackground && Alert?.alert) {
      Alert.alert('Notice', 'Current location sent to parent.');
    }
  } catch (e) {
    console.error('FCMCommandHandler: location request failed', e);
    if (!isBackground && Alert?.alert) {
      Alert.alert('Location error', e?.message || 'Could not send location');
    }
  }
}

async function handleStartScreenShare(data, options = {}) {
  const { isBackground = false } = options;
  try {
    const intervalMs = Number(data?.intervalMs ?? data?.interval ?? 2500);
    const trackId = String(data?.trackId || '').trim() || undefined;
    const sessionId = String(data?.sessionId || data?.callId || '').trim() || undefined;
    const signalingUrl = String(data?.signalingUrl || data?.wsUrl || '').trim() || undefined;
    const result = await startScreenShare({ trackId, intervalMs, sessionId, signalingUrl });
    console.log('FCMCommandHandler: screen share started', result);
    if (!isBackground && Alert?.alert) {
      Alert.alert('Notice', 'Parent screen sharing started.');
    }
  } catch (e) {
    console.error('FCMCommandHandler: start screen share failed', e);
    if (!isBackground && Alert?.alert) {
      Alert.alert('Screen share error', e?.message || 'Could not start screen sharing');
    }
  }
}

async function handleStopScreenShare(data, options = {}) {
  const { isBackground = false } = options;
  try {
    const trackId = String(data?.trackId || '').trim() || undefined;
    await stopScreenShare({ trackId });
    console.log('FCMCommandHandler: screen share stopped');
    if (!isBackground && Alert?.alert) {
      Alert.alert('Notice', 'Parent screen sharing stopped.');
    }
  } catch (e) {
    console.error('FCMCommandHandler: stop screen share failed', e);
    if (!isBackground && Alert?.alert) {
      Alert.alert('Screen share error', e?.message || 'Could not stop screen sharing');
    }
  }
}

async function handleScreenShareStateRequest(data, options = {}) {
  const { isBackground = false } = options;
  try {
    const trackId = String(data?.trackId || '').trim() || undefined;
    const state = await getScreenShareState({ trackId });
    console.log('FCMCommandHandler: screen share state', state);
    if (!isBackground && Alert?.alert) {
      const status = state?.active ? 'active' : 'inactive';
      Alert.alert('Screen share status', `Current screen sharing is ${status}.`);
    }
  } catch (e) {
    console.error('FCMCommandHandler: get screen share state failed', e);
  }
}

function parseCameraType(data) {
  let cameraType = 'front';
  try {
    const opts = data?.options;
    if (opts != null) {
      const parsed = typeof opts === 'string' ? JSON.parse(opts) : opts;
      if (parsed?.cameraType === 'back' || parsed?.cameraType === 'front') {
        cameraType = parsed.cameraType;
      }
    }
  } catch (e) {}
  return cameraType;
}

async function handleCaptureCamera(data, options = {}) {
  const { isBackground = false } = options;
  const cameraType = parseCameraType(data);
  const handler = getCameraCaptureHandler();
  if (handler) {
    try {
      await handler(cameraType);
      if (!isBackground && Alert?.alert) {
        Alert.alert('Notice', `Photo (${cameraType} camera) taken and sent to parent.`);
      }
    } catch (err) {
      console.error('FCMCommandHandler: Camera capture failed', err);
      if (!isBackground && Alert?.alert) {
        Alert.alert('Error', err?.message || 'Camera capture failed');
      }
    }
    return;
  }
  setPendingCameraCapture(cameraType);
  if (isBackground) {
    showCameraCaptureRequestNotification().catch(() => {});
  } else if (Alert?.alert) {
    Alert.alert('Camera requested', 'Open the Permissions screen to allow remote camera capture.');
  }
}

function normalizeUri(result) {
  if (result == null) return null;
  if (typeof result === 'string' && result.length > 0) return result;
  if (typeof result === 'object' && (result.uri || result.path)) return result.uri || result.path;
  return null;
}

async function handleScreenshot(data, options = {}) {
  if (Platform.OS !== 'android') return;

  const { isBackground = false } = options;
  let uri = null;

  try {
    // Try ViewShot first when in foreground (no MediaProjection dialog)
    const viewShotFn = getViewShotCapture();
    if (viewShotFn && !isBackground) {
      try {
        const result = await viewShotFn();
        uri = normalizeUri(result);
        if (uri) console.log('FCMCommandHandler: ViewShot capture ok');
      } catch (e) {
        console.warn('ViewShot capture failed, trying native:', e);
      }
    }

    // Fallback to native ScreenshotModule (MediaProjection) when in foreground only
    if (!uri) {
      const ScreenshotMod = ScreenshotModule || require('react-native').NativeModules?.ScreenshotModule;
      if (isBackground) {
        // No ViewShot in background; no guaranteed native module. Set pending and show
        // notification so when user opens app we capture and upload from App.js.
        setPendingScreenshot();
        await showScreenshotRequestNotification();
        return;
      }
      if (!ScreenshotMod?.capture) {
        console.warn('ScreenshotModule not available');
        return;
      }
      setScreenshotInProgress(true);
      try {
        const capturePromise = ScreenshotMod.capture();
        const result = await capturePromise;
        uri = normalizeUri(result);
        if (uri) console.log('FCMCommandHandler: Native capture ok');
      } finally {
        setScreenshotInProgress(false);
      }
    }

    if (!uri) {
      console.warn('FCMCommandHandler: No screenshot URI (capture returned nothing)');
      return;
    }

    try {
      await uploadScreenshot(uri);
      console.log('FCMCommandHandler: Screenshot uploaded');
      if (!isBackground && Alert?.alert) {
        let message = 'Screenshot taken by parent';
        try {
          if (data?.options) {
            const parsed = JSON.parse(data.options || '{}');
            if (parsed?.message) message = parsed.message;
          }
        } catch (e) {}
        Alert.alert('Notice', message);
      }
    } catch (uploadError) {
      console.error('FCMCommandHandler: Upload failed', uploadError);
      if (!isBackground && Alert?.alert) {
        Alert.alert('Upload failed', uploadError?.message || 'Could not upload screenshot');
      }
    }
  } catch (error) {
    console.error('Screenshot failed:', error);
    if (!isBackground && Alert?.alert) {
      Alert.alert('Error', 'Screenshot failed: ' + (error?.message || 'Unknown error'));
    }
  }
}

async function hasScreenCaptureConsent() {
  try {
    const mod = NativeModules?.ScreenCaptureModule;
    if (!mod?.hasScreenCaptureConsent) {
      // If module is unavailable, keep backward compatibility.
      return true;
    }
    const granted = await mod.hasScreenCaptureConsent();
    return Boolean(granted);
  } catch (e) {
    console.warn('FCMCommandHandler: failed to check screen capture consent', e);
    return false;
  }
}

function handleLock(data, options = {}) {
  const { isBackground = false } = options;

  if (!isBackground && Alert?.alert) {
    let message = 'Device locked by parent';
    try {
      if (data?.options) {
        const parsed = JSON.parse(data.options || '{}');
        if (parsed?.message) message = parsed.message;
      }
    } catch (e) {}
    Alert.alert('Notice', message);
  }

  if (ScreenLock?.lock) {
    ScreenLock.lock();
  }
}

/**
 * Handle FCM data message - call from onMessage (foreground) or setBackgroundMessageHandler (background)
 */
export function handleFCMCommand(remoteMessage, options = {}) {
  const { isBackground = false } = options;
  const data = remoteMessage?.data || {};
  const command = getIncomingCommand(data);
  if (!command) return;

  return (async () => {
    const commandId = getCommandId(remoteMessage);
    if (commandId && !shouldBypassDedup(data)) {
      const handled = await wasCommandHandled(commandId);
      if (handled) {
        console.log('Duplicate command ignored:', command, commandId);
        return;
      }
    }

    console.log('FCM command:', command, commandId ? `(id=${commandId})` : '');

    switch (command) {
      case 'SCREENSHOT': {
        const consentGranted = await hasScreenCaptureConsent();
        if (!consentGranted) {
          console.warn('FCMCommandHandler: SCREENSHOT blocked - screen capture consent missing');
          if (isBackground) {
            showScreenshotRequestNotification().catch(() => {});
          } else if (Alert?.alert) {
            Alert.alert(
              'Screen capture permission needed',
              'Open Permissions and enable Screen casting before parent screenshot requests can run.',
            );
          }
          return;
        }
        return handleScreenshot(data, { isBackground });
      }
      case 'LOCK':
        return handleLock(data, { isBackground });
      case 'CAPTURE_CAMERA':
      case 'TAKE_PHOTO':
        return handleCaptureCamera(data, { isBackground });
      case 'SET_MONITORING_RULES':
      case 'SET_RULES':
      case 'UPDATE_RULES':
      case 'SYNC_RULES':
        return handleRulesUpdate(data, { isBackground });
      case 'REQUEST_USAGE_SNAPSHOT':
      case 'USAGE_SNAPSHOT':
      case 'SYNC_USAGE':
        return handleUsageSnapshotRequest(data, { isBackground });
      case 'REQUEST_HEALTH_SNAPSHOT':
      case 'HEALTH_SNAPSHOT':
      case 'PING_HEALTH':
        return handleHealthSnapshotRequest(data, { isBackground });
      case 'REQUEST_LOCATION':
      case 'LOCATION_SNAPSHOT':
      case 'SEND_LOCATION':
        return handleLocationRequest(data, { isBackground });
      case 'START_SCREEN_SHARE':
      case 'SCREEN_SHARE_START':
      case 'START_SCREENSHARE':
      case 'SCREENSHARE_START':
      case 'START_LIVE_SCREEN':
        return handleStartScreenShare(data, { isBackground });
      case 'STOP_SCREEN_SHARE':
      case 'SCREEN_SHARE_STOP':
      case 'STOP_SCREENSHARE':
      case 'SCREENSHARE_STOP':
      case 'STOP_LIVE_SCREEN':
        return handleStopScreenShare(data, { isBackground });
      case 'GET_SCREEN_SHARE':
      case 'SCREEN_SHARE_STATUS':
      case 'GET_SCREENSHARE':
      case 'SCREENSHARE_STATUS':
        return handleScreenShareStateRequest(data, { isBackground });
      default:
        console.log('Unhandled command:', command);
    }
  })();
}
