/**
 * Shared screenshot capture and upload logic.
 * Used by both foreground (Permission screen) and background (FCM handler).
 */
import instance from '../api/api_instance';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Upload a screenshot file to the backend
 * @param {string} uri - File URI (file://path or content://uri)
 * @returns {Promise<object>}
 */
export async function uploadScreenshot(uri) {
  const trackId = await AsyncStorage.getItem('trackid');
  if (!trackId) {
    const err = new Error('No track ID found - device may not be linked');
    console.warn('uploadScreenshot:', err.message);
    throw err;
  }

  const formData = new FormData();
  formData.append('trackId', String(trackId));
  formData.append('image', {
    uri: typeof uri === 'string' ? uri : (uri?.uri || uri?.path || ''),
    name: 'screenshot.jpg',
    type: 'image/jpeg',
  });

  const baseURL = instance.defaults.baseURL || 'https://api.kto.solutions/api/v1';
  const url = `${baseURL}/screenshots/upload`;

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
