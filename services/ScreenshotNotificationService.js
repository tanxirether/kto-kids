/**
 * Show notification when parent requests screenshot via FCM (app in background).
 * Tapping the notification opens the app; then we capture and upload from App.js.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'screenshot_request';
let channelCreated = false;

async function ensureChannel() {
  if (channelCreated || Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Screenshot Requests',
    importance: AndroidImportance.HIGH,
  });
  channelCreated = true;
}

/**
 * Show notification when parent requests screenshot. User taps to open app; we then capture and upload.
 */
export async function showScreenshotRequestNotification() {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannel();
    await notifee.displayNotification({
      id: 'screenshot-' + Date.now(),
      title: 'Screen capture',
      body: 'Parent requested a screenshot - open app to capture',
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  } catch (e) {
    console.warn('Screenshot notification failed:', e);
  }
}

const CAMERA_CHANNEL_ID = 'camera_capture_request';

/**
 * Show notification when parent requests camera capture while app is closed/background.
 * User taps to open app; then open Permissions screen to capture and upload.
 */
export async function showCameraCaptureRequestNotification() {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: CAMERA_CHANNEL_ID,
      name: 'Camera Capture',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      id: 'camera-capture-' + Date.now(),
      title: 'Photo requested',
      body: 'Parent requested a photo - open app and go to Permissions to capture',
      android: {
        channelId: CAMERA_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  } catch (e) {
    console.warn('Camera capture notification failed:', e);
  }
}
