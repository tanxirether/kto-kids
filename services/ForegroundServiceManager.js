/**
 * Manages foreground service - MUST start while app is in foreground (Android 12+ blocks
 * starting from background). Keeps the app process alive so FCM can deliver screenshot
 * commands when user switches to another app or closes ours.
 */
import { AppState, Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { isScreenshotInProgress } from './FCMCommandHandler';

const SERVICE_ID = 1001;

let appStateSubscription = null;
let isServiceStarted = false;

async function startForegroundService() {
  if (Platform.OS !== 'android') return;
  if (isServiceStarted) return;
  if (isScreenshotInProgress()) return;

  try {
    await ReactNativeForegroundService.start({
      id: SERVICE_ID,
      title: 'KTO Kids',
      message: 'Monitoring active - Parents can request screenshots',
      ServiceType: 'dataSync',
      visibility: 'public',
      importance: 'min',
    });
    isServiceStarted = true;
    console.log('Foreground service started');
  } catch (error) {
    console.error('Failed to start foreground service:', error);
  }
}

async function stopForegroundService() {
  if (Platform.OS !== 'android') return;
  if (!isServiceStarted) return;

  try {
    await ReactNativeForegroundService.stop();
    isServiceStarted = false;
    console.log('Foreground service stopped');
  } catch (error) {
    console.error('Failed to stop foreground service:', error);
  }
}

export function initForegroundServiceManager() {
  if (Platform.OS !== 'android') return () => {};

  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      startForegroundService();
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
