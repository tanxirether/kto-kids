/**
 * Manages foreground service - MUST start while app is in foreground (Android 12+ blocks
 * starting from background). Keeps the app process alive so FCM can deliver screenshot
 * commands when user switches to another app or closes ours.
 */
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import notifee from '@notifee/react-native';
import { isScreenshotInProgress } from './FCMCommandHandler';
import {
  getCurrentForegroundPackage,
  getLastForeground,
  getTodayUsageMs,
  getTodayUsageMsUsageStats,
  getUsageAccessDebug,
  hasUsageAccess,
  isAccessibilityEnabled,
} from './AccessibilityServiceBridge';
import { uploadMonitoringSnapshot } from './MonitoringSnapshotService';

const SERVICE_ID = 1001;
const HEARTBEAT_TASK_ID = 'fg_service_heartbeat';
const HEARTBEAT_DELAY_MS = 15000;
const FOREGROUND_CHANNEL_ID = 'com.supersami.foregroundservice.channel';
const USAGE_DEBUG_SYNC_EVERY_MS = 60000;

let appStateSubscription = null;
let isServiceStarted = false;
let heartbeatStarted = false;
let usageDebugSyncInFlight = false;
let lastUsageDebugSyncMs = 0;

function formatClockTime(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

async function updateForegroundNotification(statusLabel) {
  try {
    await ReactNativeForegroundService.update({
      id: SERVICE_ID,
      title: 'KTO Kids Monitoring',
      message: `${statusLabel} | Last ping: ${formatClockTime()}`,
      ServiceType: 'dataSync',
      visibility: 'public',
      importance: 'high',
      icon: 'ic_launcher',
      largeIcon: 'ic_launcher',
    });
  } catch (error) {
    // update may fail briefly right after start; avoid noisy crashes
    console.warn('Foreground notification update skipped:', error?.message || error);
  }
}

async function maybeUploadUsageDebugSnapshot() {
  if (!isServiceStarted) return;
  if (usageDebugSyncInFlight) return;

  const now = Date.now();
  if (now - lastUsageDebugSyncMs < USAGE_DEBUG_SYNC_EVERY_MS) return;

  usageDebugSyncInFlight = true;
  try {
    let [usageByPackage, lastForeground, currentForeground, usageAccess, accessibilityEnabled, usageDebug] =
      await Promise.all([
        getTodayUsageMs().catch(() => ({})),
        getLastForeground().catch(() => ({ packageName: '', timestampMs: 0 })),
        getCurrentForegroundPackage().catch(() => ''),
        hasUsageAccess().catch(() => false),
        isAccessibilityEnabled().catch(() => false),
        getUsageAccessDebug().catch(() => ({})),
      ]);

    // Fallback for debug: when accessibility-based store is empty, try UsageStats source.
    if (!usageByPackage || Object.keys(usageByPackage).length === 0) {
      usageByPackage = await getTodayUsageMsUsageStats().catch(() => ({}));
    }

    await uploadMonitoringSnapshot({
      kind: 'debug-minute-sync',
      usageByPackage,
      lastForeground,
      currentForegroundPackage: currentForeground,
      hasUsageAccess: usageAccess,
      isAccessibilityEnabled: accessibilityEnabled,
      usageDebug,
      capturedAtMs: now,
    });

    lastUsageDebugSyncMs = now;
    console.log('Usage debug sync uploaded');
  } catch (error) {
    console.warn('Usage debug sync failed:', error?.message || error);
  } finally {
    usageDebugSyncInFlight = false;
  }
}

function ensureHeartbeatTask() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;

  ReactNativeForegroundService.add_task(
    async () => {
      if (!isServiceStarted) return;
      const appState = AppState.currentState === 'active' ? 'Foreground' : 'Background';
      await updateForegroundNotification(`${appState} service running`);
      await maybeUploadUsageDebugSnapshot();
    },
    {
      taskId: HEARTBEAT_TASK_ID,
      delay: HEARTBEAT_DELAY_MS,
      onLoop: true,
      onError: (e) => console.warn('Foreground heartbeat error:', e),
    },
  );
}

async function startForegroundService() {
  if (Platform.OS !== 'android') return;
  if (isServiceStarted) return true;
  if (isScreenshotInProgress()) return false;

  try {
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (!granted) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Foreground notification permission denied');
          return;
        }
      }
    }

    // Foreground-service channel importance can be "stuck" from older app runs.
    // Recreate it so current "high" importance takes effect.
    try {
      await notifee.deleteChannel(FOREGROUND_CHANNEL_ID);
    } catch {}

    await ReactNativeForegroundService.start({
      id: SERVICE_ID,
      title: 'KTO Kids Monitoring',
      message: `Foreground service started | Last ping: ${formatClockTime()}`,
      ServiceType: 'dataSync',
      visibility: 'public',
      importance: 'high',
      icon: 'ic_launcher',
      largeIcon: 'ic_launcher',
    });
    isServiceStarted = true;
    ensureHeartbeatTask();
    await updateForegroundNotification('Foreground service running');
    console.log('Foreground service started');
    return true;
  } catch (error) {
    console.error('Failed to start foreground service:', error);
    return false;
  }
}

async function stopForegroundService() {
  if (Platform.OS !== 'android') return;
  if (!isServiceStarted) return true;

  try {
    ReactNativeForegroundService.remove_task(HEARTBEAT_TASK_ID);
    heartbeatStarted = false;
    await ReactNativeForegroundService.stop();
    isServiceStarted = false;
    console.log('Foreground service stopped');
    return true;
  } catch (error) {
    console.error('Failed to stop foreground service:', error);
    return false;
  }
}

export function initForegroundServiceManager() {
  if (Platform.OS !== 'android') return () => {};

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      startForegroundService();
    } else if (isServiceStarted) {
      updateForegroundNotification('Background service running');
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Start after a short delay so activity is fully ready
  const startTimer = setTimeout(() => {
    if (AppState.currentState === 'active') {
      startForegroundService();
    }
  }, 500);

  return () => {
    clearTimeout(startTimer);
    appStateSubscription?.remove();
    stopForegroundService();
  };
}

// Debug helper: lets UI manually trigger foreground notification/service.
export async function debugStartForegroundService() {
  const ok = await startForegroundService();
  const running = ReactNativeForegroundService.is_running?.() === true;
  if (!ok || !running) {
    throw new Error('Foreground service did not start. Check logcat for "Failed to start foreground service".');
  }
}

// Debug helper: lets UI manually stop service to test restart behavior.
export async function debugStopForegroundService() {
  const ok = await stopForegroundService();
  if (!ok) {
    throw new Error('Foreground service did not stop. Check logcat for details.');
  }
}
