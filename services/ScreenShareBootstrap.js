import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  configureScreenShareIceServers,
  configureScreenShareRealtime,
  initScreenShareRuntime,
  getScreenShareRuntimeState,
} from './ScreenShareService';
import { releaseScreenCapture } from './ScreenShareWebRTC';
import { hasMonitoringConsent } from './MonitoringConsentGate';

// A screen capture kept alive across sessions (to avoid repeating the "Start now" dialog) has
// been observed to silently start producing black frames - its track still reports readyState
// "live" - after the screen goes through an off/on cycle. Capturing while the screen is off is
// blocked by Android anyway, so dropping the stale capture here costs nothing; the next session
// acquires a fresh one. Only drop it when nothing is actively using it right now, so a session
// that is mid-call when the screen happens to lock isn't abruptly cut.
function wireScreenOffCleanup() {
  if (Platform.OS !== 'android' || !NativeModules.DeviceAccessModule) return;
  const emitter = new NativeEventEmitter(NativeModules.DeviceAccessModule);
  emitter.addListener('kto_screen_off', () => {
    const state = getScreenShareRuntimeState();
    // Any in-progress session (waiting_offer/answering/connecting/connected) keeps its capture;
    // only an idle, kept-alive-for-next-time capture gets dropped here.
    if (state?.hasSession) return;
    releaseScreenCapture();
  });
}

// Runs from index.js (not a React component) so the realtime subscription that receives the
// parent's screen/camera/mic requests survives the activity being destroyed when the app is
// swiped from recents, and also starts when FCM wakes the app headlessly.
export function configureScreenShare() {
  // TEMPORARY test relay (shared public TURN, limited and not for production).
  // Replace with your own TURN server or serve short-lived credentials from the backend
  // (/screen-share/webrtc/ice-servers). Video stays DTLS-SRTP encrypted through the relay.
  configureScreenShareIceServers([
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ]);
  configureScreenShareRealtime({
    key: 'deca346055651392a9a6',
    cluster: 'ap4',
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
  });
  wireScreenOffCleanup();
}

// initScreenShareRuntime is idempotent, so calling it again from App is harmless.
export async function startScreenShareRuntimeIfConsented() {
  if (!(await hasMonitoringConsent())) return;
  initScreenShareRuntime();
}
