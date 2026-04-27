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
const pendingRemoteCandidates = [];
let stats = {
  iceSent: 0,
  iceReceived: 0,
};
const LOG_LIMIT = 80;
const webrtcLogs = [];

function emitState(state, extra = {}) {
  onStateChangeHandler?.(state, extra);
}

function logStep(message, payload = {}) {
  const entry = {
    at: new Date().toISOString(),
    message: String(message || ''),
    payload: payload && typeof payload === 'object' ? payload : {},
  };
  webrtcLogs.push(entry);
  if (webrtcLogs.length > LOG_LIMIT) {
    webrtcLogs.splice(0, webrtcLogs.length - LOG_LIMIT);
  }
  console.log('ScreenShareWebRTC:', message, payload);
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

function extractVideoTrackSnapshot(stream) {
  const tracks = stream?.getVideoTracks?.() || [];
  return tracks.map((track) => ({
    id: String(track?.id || ''),
    enabled: Boolean(track?.enabled),
    readyState: String(track?.readyState || ''),
    muted: Boolean(track?.muted),
  }));
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
  logStep('POST /screen-share/webrtc/signal request', payload);
  const maxAttempts = signalType === 'answer' ? 3 : 1;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await instance.post('/screen-share/webrtc/signal', payload);
      logStep('POST /screen-share/webrtc/signal response', {
        status: response?.status,
        data: response?.data,
        signalType,
        attempt,
      });
      return response;
    } catch (e) {
      lastError = e;
      logStep('POST /screen-share/webrtc/signal error', {
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message || String(e || ''),
        signalType,
        attempt,
      });
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }
  throw lastError || new Error('Signal post failed');
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
      stats.iceSent += 1;
      const candidatePayload = candidate.toJSON ? candidate.toJSON() : candidate;
      await postSignal({
        trackId,
        sessionId,
        signalType: 'ice-candidate',
        candidate: candidatePayload,
        target: 'parent',
      });
      logStep('ice sent', { count: stats.iceSent });
    } catch (e) {
      onErrorHandler?.(new Error(`Failed to post ICE candidate: ${e?.message || e}`));
    }
  };
  peerConnection.onconnectionstatechange = () => {
    const state = String(peerConnection?.connectionState || '');
    logStep('peer connection state changed', { state });
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
  logStep('cleanup start', {
    trackId: activeSession?.trackId || '',
    sessionId: activeSession?.sessionId || '',
  });
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
  pendingRemoteCandidates.length = 0;
  stats = { iceSent: 0, iceReceived: 0 };
  logStep('cleanup end');
}

async function applyRemoteCandidate(candidateObject) {
  if (!peerConnection || !candidateObject) return;
  const fp = candidateFingerprint(candidateObject);
  if (!fp || receivedIceFingerprintSet.has(fp)) return;
  receivedIceFingerprintSet.add(fp);
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidateObject));
    stats.iceReceived += 1;
    logStep('ice received', { count: stats.iceReceived });
  } catch (e) {
    // Early or malformed ICE should not crash the session.
    logStep('addIceCandidate skipped', {
      message: e?.message || String(e || ''),
      candidate: candidateObject,
    });
  }
}

async function flushPendingRemoteCandidates() {
  if (!peerConnection?.remoteDescription) return;
  while (pendingRemoteCandidates.length > 0) {
    const next = pendingRemoteCandidates.shift();
    await applyRemoteCandidate(next);
  }
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
  logStep('session started', activeSession);

  emitState('preparing_media');
  localStream = await createLocalStream(activeSession.mediaType);
  const videoTracks = localStream?.getVideoTracks?.() || [];
  if (videoTracks.length === 0) {
    throw new Error('No local screen video track found');
  }
  for (const track of videoTracks) {
    try {
      track.enabled = true;
    } catch {}
  }
  logStep('local stream prepared', {
    mediaType: activeSession.mediaType,
    trackCount: localStream?.getTracks?.()?.length || 0,
    videoTracks: extractVideoTrackSnapshot(localStream),
  });

  peerConnection = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
  wirePeerEvents();

  emitState('waiting_offer');
  logStep('waiting for parent offer', {
    trackId: activeSession.trackId,
    sessionId: activeSession.sessionId,
  });
  offerTimeout = setTimeout(() => {
    logStep('timeout fired', {
      reason: 'waiting-parent-offer',
      trackId: activeSession?.trackId || '',
      sessionId: activeSession?.sessionId || '',
    });
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
  logStep('signal received', {
    trackId,
    sessionId,
    signalType: normalizedType,
    hasSdp: Boolean(sdp),
    hasCandidate: Boolean(candidate),
  });

  if (normalizedType === 'offer' && sdp) {
    clearOfferTimeout();
    emitState('answering');
    logStep('offer received', { trackId, sessionId });
    const offerSdp =
      typeof sdp === 'string'
        ? sdp
        : typeof sdp === 'object'
          ? String(sdp.sdp || '')
          : '';
    if (!offerSdp) throw new Error('Offer SDP missing or invalid');
    const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp: offerSdp });
    try {
      await peerConnection.setRemoteDescription(remoteDesc);
      logStep('setRemoteDescription success', { trackId, sessionId });
    } catch (e) {
      logStep('setRemoteDescription failed', {
        trackId,
        sessionId,
        message: e?.message || String(e || ''),
      });
      throw e;
    }
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    logStep('answer created', { hasSdp: Boolean(answer?.sdp) });
    await postSignal({
      trackId,
      sessionId: sessionId || activeSession?.sessionId || '',
      signalType: 'answer',
      sdp: answer?.sdp,
      target: 'parent',
    });
    logStep('answer sent', { trackId, sessionId: sessionId || activeSession?.sessionId || '' });
    logStep('local screen track status', {
      videoTracks: extractVideoTrackSnapshot(localStream),
    });
    await flushPendingRemoteCandidates();
    emitState('connecting');
    return true;
  }

  if (normalizedType === 'ice-candidate' && candidate) {
    const candidateObject =
      typeof candidate === 'string'
        ? { candidate, sdpMid: null, sdpMLineIndex: null }
        : candidate;
    if (!peerConnection?.remoteDescription) {
      pendingRemoteCandidates.push(candidateObject);
      logStep('ice queued until remote description set', {
        queuedCount: pendingRemoteCandidates.length,
      });
      return true;
    }
    await applyRemoteCandidate(candidateObject);
    return true;
  }

  return false;
}

export async function stopWebRTCScreenShareSession() {
  logStep('stop requested', {
    trackId: activeSession?.trackId || '',
    sessionId: activeSession?.sessionId || '',
  });
  await cleanupTransport();
}

export async function stopWebRTCScreenShareRemotely({ trackId, sessionId, reason } = {}) {
  if (!trackId) return;
  const payload = {
    trackId,
    sessionId,
    reason: reason || 'child-ended',
  };
  logStep('POST /screen-share/webrtc/stop request', payload);
  try {
    const response = await instance.post('/screen-share/webrtc/stop', payload);
    logStep('POST /screen-share/webrtc/stop response', {
      status: response?.status,
      data: response?.data,
    });
  } catch (e) {
    logStep('POST /screen-share/webrtc/stop error', {
      status: e?.response?.status,
      data: e?.response?.data,
      message: e?.message || String(e || ''),
    });
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
    pendingRemoteIceCount: pendingRemoteCandidates.length,
    iceSentCount: stats.iceSent,
    iceReceivedCount: stats.iceReceived,
  };
}

export function ensureWebRTCScreenShareSession() {
  if (!activeSession || !peerConnection) return false;
  const state = String(peerConnection?.connectionState || '');
  return state === 'connected' || state === 'connecting';
}

export function getWebRTCScreenShareLogs(limit = 40) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 40));
  return webrtcLogs.slice(-safeLimit);
}

