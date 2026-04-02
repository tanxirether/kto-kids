/**
 * When parent sends SCREENSHOT via FCM while app is in background, we set a pending flag
 * and show a notification. When user opens the app, we capture and upload then clear the flag.
 */
/*let _pending = false;

export function setPending() {
  _pending = true;
}

export function clearPending() {
  _pending = false;
}

export function isPending() {
  return _pending;
} */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pendingScreenshot';
let _pending = false;

export function setPending() {
  _pending = true;
  AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
}

export function clearPending() {
  _pending = false;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export function isPending() {
  return _pending;
}

export async function restorePendingFromStorage() {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    _pending = val === '1';
    return _pending;
  } catch {
    return false;
  }
}