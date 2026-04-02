/**
 * When CAPTURE_CAMERA is received but no camera handler is registered
 * (e.g. app in background or killed), we store the requested camera type.
 * Persisted to AsyncStorage so it survives app kill; when user opens app
 * and goes to Permission screen, we run the pending capture.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pendingCameraCapture';

let _pending = null;

export function setPending(cameraType) {
  _pending = cameraType;
  AsyncStorage.setItem(STORAGE_KEY, cameraType).catch(() => {});
}

export function getPending() {
  return _pending;
}

export function clearPending() {
  _pending = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export function isPending() {
  return _pending != null;
}

/**
 * Restore pending from storage (call on app launch so pending survives app kill).
 * @returns {Promise<'front'|'back'|null>}
 */
export async function restorePendingFromStorage() {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    if (val === 'front' || val === 'back') {
      _pending = val;
      return val;
    }
  } catch (e) {}
  return null;
}
