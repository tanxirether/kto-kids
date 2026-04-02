/**
 * Global FCM command handler - works on ANY screen and when app is backgrounded.
 * Foreground: captures via ViewShot (or native ScreenshotModule if available).
 * Background: sets pending flag + shows notification; when app opens we capture and upload.
 */
import { NativeModules, Alert, Platform } from 'react-native';
import { showScreenshotRequestNotification, showCameraCaptureRequestNotification } from './ScreenshotNotificationService';
import { setPending as setPendingScreenshot } from './PendingScreenshotManager';

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

const { ScreenshotModule, ScreenLock } = NativeModules;

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
  const { command } = remoteMessage.data || {};
  if (!command) return;

  console.log('FCM command:', command);

  switch (command) {
    case 'SCREENSHOT':
      return handleScreenshot(remoteMessage.data, { isBackground });
    case 'LOCK':
      return handleLock(remoteMessage.data, { isBackground });
    case 'CAPTURE_CAMERA':
    case 'TAKE_PHOTO':
      return handleCaptureCamera(remoteMessage.data, { isBackground });
    default:
      console.log('Unhandled command:', command);
  }
}
