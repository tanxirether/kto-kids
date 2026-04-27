import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import instance from '../api/api_instance';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const DEFAULT_OFFER_TIMEOUT_MS = 30000;

let peerConnection = null;
let localStream = null;
let activeSession = null;
let localScreenStreamProvider = null;
let localCameraStreamProvider = null;
let offerTimeout = null;
let onStateChangeHandler = null;
let onErrorHandler = null;
let onConnectedHandler = null;
let onEndedHandler = null;
const emittedIceFingerprintSet = new Set();
const receivedIceFingerprintSet = new Set();

function emitState(state, extra = {}) {
  onStateChangeHandler?.(state, extra);
}

function clearOfferTimeout() {
  if (offerTimeout) {
    clearTimeout(offerTimeout);
    offerTimeout = null;
  }
}

function candidateFingerprint(candidate) {
  const raw =
    candidate?.candidate ||
    candidate?.toJSON?.()?.candidate ||
    (typeof candidate === 'string' ? candidate : '') ||
    '';
  return String(raw || '').trim();
}

async function postSignal({
  trackId,
  sessionId,
  signalType,
  sdp,
  candidate,
  target = 'parent',
}) {
  const payload = {
    trackId,
    sessionId,
    signalType,
    senderType: 'child',
    target,
  };
  if (sdp) payload.sdp = sdp;
  if (candidate) payload.candidate = candidate;
  return instance.post('/screen-share/webrtc/signal', payload);
}

async function getLocalScreenStream() {
  if (typeof localScreenStreamProvider === 'function') {
    return localScreenStreamProvider();
  }
  if (typeof mediaDevices?.getDisplayMedia === 'function') {
    return mediaDevices.getDisplayMedia({ video: true, audio: false });
  }
  throw new Error('Screen capture stream provider is not available');
}

async function getLocalCameraStream() {
  if (typeof localCameraStreamProvider === 'function') {
    return localCameraStreamProvider();
  }
  if (typeof mediaDevices?.getUserMedia === 'function') {
    return mediaDevices.getUserMedia({ video: true, audio: false });
  }
  throw new Error('Camera stream provider is not available');
}

async function createLocalStream(mediaType) {
  const type = String(mediaType || 'screen').toLowerCase();
  if (type === 'camera') return getLocalCameraStream();
  return getLocalScreenStream();
}

function wirePeerEvents() {
  if (!peerConnection || !activeSession) return;
  const { trackId, sessionId } = activeSession;
  peerConnection.onicecandidate = async (event) => {
    const candidate = event?.candidate;
    if (!candidate) return;
    const fp = candidateFingerprint(candidate);
    if (!fp || emittedIceFingerprintSet.has(fp)) return;
    emittedIceFingerprintSet.add(fp);
    try {
      await postSignal({
        trackId,
        sessionId,
        signalType: 'ice-candidate',
        candidate: candidate.toJSON ? candidate.toJSON() : candidate,
        target: 'parent',
      });
    } catch (e) {
      onErrorHandler?.(new Error(`Failed to post ICE candidate: ${e?.message || e}`));
    }
  };
  peerConnection.onconnectionstatechange = () => {
    const state = String(peerConnection?.connectionState || '');
    if (state === 'connecting') emitState('connecting');
    if (state === 'connected') {
      emitState('connected');
      onConnectedHandler?.();
    }
    if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      onErrorHandler?.(new Error(`Peer connection ${state}`));
    }
  };
}

async function cleanupTransport() {
  clearOfferTimeout();
  try {
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }
  } catch {}
  peerConnection = null;

  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }
  } catch {}
  localStream = null;
  activeSession = null;
  emittedIceFingerprintSet.clear();
  receivedIceFingerprintSet.clear();
}

export function setScreenStreamProvider(providerFn) {
  localScreenStreamProvider = typeof providerFn === 'function' ? providerFn : null;
}

export function setCameraStreamProvider(providerFn) {
  localCameraStreamProvider = typeof providerFn === 'function' ? providerFn : null;
}

export async function startWebRTCScreenShareSession({
  trackId,
  sessionId,
  mediaType = 'screen',
  iceServers = DEFAULT_ICE_SERVERS,
  offerTimeoutMs = DEFAULT_OFFER_TIMEOUT_MS,
  onStateChange,
  onError,
  onConnected,
  onEnded,
} = {}) {
  if (!trackId) throw new Error('trackId is required');
  if (!sessionId) throw new Error('sessionId is required');

  onStateChangeHandler = typeof onStateChange === 'function' ? onStateChange : null;
  onErrorHandler = typeof onError === 'function' ? onError : null;
  onConnectedHandler = typeof onConnected === 'function' ? onConnected : null;
  onEndedHandler = typeof onEnded === 'function' ? onEnded : null;

  await cleanupTransport();

  activeSession = {
    trackId: String(trackId),
    sessionId: String(sessionId),
    mediaType: String(mediaType || 'screen'),
    startedAt: Date.now(),
  };

  emitState('preparing_media');
  localStream = await createLocalStream(activeSession.mediaType);

  peerConnection = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
  wirePeerEvents();

  emitState('waiting_offer');
  offerTimeout = setTimeout(() => {
    onErrorHandler?.(new Error('Timed out waiting for parent offer'));
    onEndedHandler?.('offer-timeout');
  }, Math.max(5000, Number(offerTimeoutMs) || DEFAULT_OFFER_TIMEOUT_MS));
}

function sessionMatches(trackId, sessionId) {
  if (!activeSession) return false;
  const sameTrack = String(activeSession.trackId) === String(trackId);
  if (!sameTrack) return false;
  const incomingSession = String(sessionId || '').trim();
  if (!incomingSession) return true;
  return String(activeSession.sessionId) === incomingSession;
}

export async function processWebRTCSignal({ trackId, sessionId, signalType, sdp, candidate } = {}) {
  if (!peerConnection || !sessionMatches(trackId, sessionId)) return false;
  const normalizedType = String(signalType || '').toLowerCase();

  if (normalizedType === 'offer' && sdp) {
    clearOfferTimeout();
    emitState('answering');
    const offerSdp =
      typeof sdp === 'string'
        ? sdp
        : typeof sdp === 'object'
          ? String(sdp.sdp || '')
          : '';
    if (!offerSdp) throw new Error('Offer SDP missing or invalid');
    const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp: offerSdp });
    await peerConnection.setRemoteDescription(remoteDesc);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await postSignal({
      trackId,
      sessionId: sessionId || activeSession?.sessionId || '',
      signalType: 'answer',
      sdp: answer?.sdp,
      target: 'parent',
    });
    emitState('connecting');
    return true;
  }

  if (normalizedType === 'ice-candidate' && candidate) {
    const candidateObject =
      typeof candidate === 'string'
        ? { candidate, sdpMid: null, sdpMLineIndex: null }
        : candidate;
    const fp = candidateFingerprint(candidateObject);
    if (!fp || receivedIceFingerprintSet.has(fp)) return true;
    receivedIceFingerprintSet.add(fp);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidateObject));
    return true;
  }

  return false;
}

export async function stopWebRTCScreenShareSession() {
  await cleanupTransport();
}

export async function stopWebRTCScreenShareRemotely({ trackId, sessionId, reason } = {}) {
  if (!trackId) return;
  try {
    await instance.post('/screen-share/webrtc/stop', {
      trackId,
      sessionId,
      reason: reason || 'child-stopped',
    });
  } catch (e) {
    console.warn('ScreenShareWebRTC: remote stop failed', e?.message || e);
  }
}

export function getWebRTCScreenShareHealth() {
  return {
    active: Boolean(activeSession),
    trackId: activeSession?.trackId || '',
    sessionId: activeSession?.sessionId || '',
    mediaType: activeSession?.mediaType || '',
    peerState: peerConnection?.connectionState || 'none',
    localTrackCount: localStream?.getTracks?.()?.length || 0,
  };
}

export function ensureWebRTCScreenShareSession() {
  if (!activeSession || !peerConnection) return false;
  const state = String(peerConnection?.connectionState || '');
  return state === 'connected' || state === 'connecting';
}

