import {
  configureScreenShareIceServers,
  configureScreenShareRealtime,
  initScreenShareRuntime,
} from './ScreenShareService';
import { hasMonitoringConsent } from './MonitoringConsentGate';

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
}

// initScreenShareRuntime is idempotent, so calling it again from App is harmless.
export async function startScreenShareRuntimeIfConsented() {
  if (!(await hasMonitoringConsent())) return;
  initScreenShareRuntime();
}
