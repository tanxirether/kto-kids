/**
 * Upload a camera photo (front/back) to the backend.
 * Used when parent requests remote camera capture via CAPTURE_CAMERA command.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import instance from '../api/api_instance';

/**
 * Normalize file path for FormData upload (Android often needs file:// prefix)
 */
function normalizeFileUri(uri) {
  const path = typeof uri === 'string' ? uri : (uri?.uri || uri?.path || '');
  if (!path) return path;
  if (path.startsWith('content://') || path.startsWith('file://')) return path;
  if (Platform.OS === 'android' && path.startsWith('/')) return `file://${path}`;
  return path;
}

/**
 * Upload a captured camera photo to the backend
 * @param {string} uri - File URI (file://path or absolute path)
 * @param {'front'|'back'} cameraType - Which camera took the photo
 * @returns {Promise<object>}
 */
export async function uploadCameraPhoto(uri, cameraType = 'front') {
  const trackId = await AsyncStorage.getItem('trackid');
  if (!trackId) {
    const err = new Error('No track ID found - device may not be linked');
    console.warn('uploadCameraPhoto:', err.message);
    throw err;
  }

  const fileUri = normalizeFileUri(uri);
  const formData = new FormData();
  formData.append('trackId', String(trackId));
  formData.append('cameraType', cameraType);
  formData.append('image', {
    uri: fileUri,
    name: `camera-${cameraType}-${Date.now()}.jpg`,
    type: 'image/jpeg',
  });

  const baseURL = instance.defaults.baseURL || 'https://api.kto.solutions/api/v1';
  const url = `${baseURL}/photos/upload`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {},
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${text || response.statusText}`);
  }

  return response.json();
}
