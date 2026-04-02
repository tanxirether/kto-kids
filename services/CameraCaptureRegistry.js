/**
 * Registry for the current camera capture function (Permission screen).
 * When CAPTURE_CAMERA FCM command is received, we call this if registered.
 * If not registered (user not on Permission screen), we set a pending capture.
 */
let _captureFn = null;

export function register(captureFn) {
  _captureFn = captureFn;
}

export function unregister() {
  _captureFn = null;
}

export function getCameraCaptureHandler() {
  return _captureFn;
}
