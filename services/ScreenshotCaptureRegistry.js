/**
 * Registry for the current ViewShot capture function.
 * App.js registers the root ViewShot so we can capture the app screen when
 * a pending screenshot request is handled (e.g. after opening app from notification).
 */
let _captureFn = null;

export function register(captureFn) {
  _captureFn = captureFn;
}

export function unregister() {
  _captureFn = null;
}

export function getViewShotCapture() {
  return _captureFn;
}
