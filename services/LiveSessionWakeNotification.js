/**
 * Brings the app to the foreground when a parent's live camera/screen-share session needs a
 * running Activity (react-native-webrtc's getUserMedia() rejects with "No current Activity."
 * once the app was swiped from recents and the activity got destroyed, even though the process
 * and JS keep running).
 *
 * Uses a full-screen-intent notification targeting MainActivity directly - no extra native
 * Activity needed. Android auto-launches it when the device is locked/screen-off; when the
 * screen is already on and unlocked, Android shows it as a normal heads-up notification that
 * needs a tap instead (a deliberate OS privacy restriction, not something to work around).
 *
 * Once MainActivity resumes, ScreenShareService's existing AppState "active" handling
 * (runtimeTick) retries the pending session automatically - no extra plumbing needed here.
 */
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { NativeModules, Platform } from 'react-native';

const { DeviceAccessModule } = NativeModules;
const CHANNEL_ID = 'live_session_wake';
let channelCreated = false;
let lastShownAtMs = 0;
const MIN_INTERVAL_MS = 4000; // avoid a notification per ICE-candidate-triggered retry

async function ensureChannel() {
  if (channelCreated || Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Live monitoring session',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  });
  channelCreated = true;
}

export async function canUseFullScreenIntent() {
  if (Platform.OS !== 'android' || !DeviceAccessModule?.canUseFullScreenIntent) return true;
  try {
    return await DeviceAccessModule.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

export function openFullScreenIntentSettings() {
  if (Platform.OS !== 'android') return;
  DeviceAccessModule?.openFullScreenIntentSettings?.();
}

/**
 * mediaType: 'camera' | 'screen' | 'audio' - only used for the notification text.
 */
export async function showLiveSessionWakeNotification(mediaType = 'screen') {
  if (Platform.OS !== 'android') return;
  const now = Date.now();
  if (now - lastShownAtMs < MIN_INTERVAL_MS) return;
  lastShownAtMs = now;
  try {
    await ensureChannel();
    const label = mediaType === 'camera' ? 'camera' : mediaType === 'audio' ? 'microphone' : 'screen';
    await notifee.displayNotification({
      id: 'live-session-wake',
      title: 'Parent session active',
      body: `Reopening to continue the ${label} session...`,
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default', launchActivity: 'com.kto_kids.MainActivity' },
        fullScreenAction: { id: 'default', launchActivity: 'com.kto_kids.MainActivity' },
        ongoing: false,
        autoCancel: true,
      },
    });
  } catch (e) {
    console.warn('LiveSessionWakeNotification: failed to show', e?.message || e);
  }
}

export async function clearLiveSessionWakeNotification() {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.cancelNotification('live-session-wake');
  } catch {
    // best effort
  }
}
