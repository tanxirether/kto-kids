import { NativeModules, Platform } from 'react-native';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pusher from 'pusher-js/react-native';
import instance from '../api/api_instance';
import {
  startWebRTCScreenShareSession,
  stopWebRTCScreenShareSession,
  processWebRTCSignal,
  stopWebRTCScreenShareRemotely,
} from './ScreenShareWebRTC';

const ScreenShareModule = NativeModules?.ScreenShareModule;
const ScreenCaptureModule = NativeModules?.ScreenCaptureModule;
const SCREEN_SHARE_RUNTIME_TICK_MS = 15000;
const DEFAULT_OFFER_TIMEOUT_MS = 30000;
const SCREEN_SHARE_STATES = {
  IDLE: 'idle',
  REQUESTED: 'requested',
  PREPARING_MEDIA: 'preparing_media',
  WAITING_OFFER: 'waiting_offer',
  ANSWERING: 'answering',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ENDING: 'ending',
  ERROR: 'error',
};

let runtimeTickTimer = null;
let runtimeInFlight = false;
let realtimeClient = null;
let realtimeChannel = null;
let currentFamilyChannelName = '';
let appStateSubscription = null;
let activeSession = null;
let activeState = SCREEN_SHARE_STATES.IDLE;
const seenEventKeys = new Set();
let waitingOfferTimer = null;
let remoteRevisionSeen = '';
let pusherConfigOverride = null;

function setScreenShareState(nextState, extra = {}) {
  activeState = String(nextState || SCREEN_SHARE_STATES.IDLE);
  console.log('ScreenShareService: state ->', activeState, extra);
}

function normalizeSessionPayload(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const data = root.data && typeof root.data === 'object' ? root.data : root;
  const signal = data.signal && typeof data.signal === 'object' ? data.signal : {};
  const trackId = String(data.trackId || data.track_id || '').trim();
  const sessionId = String(data.sessionId || data.session_id || '').trim();
  const mediaType = String(data.mediaType || data.media_type || 'screen').trim().toLowerCase();
  const intervalMs = normalizeIntervalMs(data.intervalMs ?? data.interval_ms ?? 2500);
  const rawSignalType = data.signalType || data.signal_type || data.type || signal.type || '';
  const signalType = String(rawSignalType).trim().toLowerCase();
  const source = String(data.senderType || data.sender_type || data.sender || '').trim().toLowerCase();
  const candidate =
    data.candidate ||
    data.iceCandidate ||
    data.ice_candidate ||
    signal.candidate ||
    null;
  const sdp =
    data.sdp ||
    data.offer?.sdp ||
    data.answer?.sdp ||
    signal.sdp ||
    (typeof data.offer === 'string' ? data.offer : '') ||
    '';
  return {
    trackId,
    sessionId,
    mediaType: mediaType === 'camera' ? 'camera' : 'screen',
    intervalMs,
    signalType,
    senderType: source,
    candidate,
    sdp,
    revision: String(data.revision || '').trim(),
  };
}

function clearWaitingOfferTimer() {
  if (waitingOfferTimer) {
    clearTimeout(waitingOfferTimer);
    waitingOfferTimer = null;
  }
}

function buildEventKey(eventName, payload) {
  const s = normalizeSessionPayload(payload);
  return [
    eventName,
    s.trackId,
    s.sessionId,
    s.signalType,
    s.revision,
    JSON.stringify(s.candidate || ''),
    s.sdp ? s.sdp.slice(0, 24) : '',
  ].join('|');
}

async function resolveFamilyChannelName() {
  const familyId = String((await AsyncStorage.getItem('familyId')) || '').trim();
  if (!familyId) return '';
  return `family_${familyId}`;
}

function matchesActiveSession(trackId, sessionId) {
  if (!activeSession) return false;
  const sameTrack = String(activeSession.trackId) === String(trackId);
  if (!sameTrack) return false;
  const incomingSession = String(sessionId || '').trim();
  if (!incomingSession) return true;
  return String(activeSession.sessionId) === incomingSession;
}

async function stopActiveSession(reason = 'stopped', { notifyBackend = true } = {}) {
  if (!activeSession) return;
  setScreenShareState(SCREEN_SHARE_STATES.ENDING, { reason });
  clearWaitingOfferTimer();
  const toStop = { ...activeSession };
  activeSession = null;
  await stopWebRTCScreenShareSession().catch(() => {});
  await stopScreenShare({ trackId: toStop.trackId }).catch(() => {});
  if (notifyBackend) {
    await stopWebRTCScreenShareRemotely({
      trackId: toStop.trackId,
      sessionId: toStop.sessionId,
      reason,
    }).catch(() => {});
  }
  setScreenShareState(SCREEN_SHARE_STATES.IDLE, { reason });
}

async function onWebRTCSessionError(err) {
  console.warn('ScreenShareService: webrtc error', err?.message || err);
  setScreenShareState(SCREEN_SHARE_STATES.ERROR, { message: err?.message || String(err || '') });
  await stopActiveSession('webrtc-error', { notifyBackend: true });
}

async function startRequestedSession({ trackId, sessionId, mediaType, intervalMs }) {
  if (!trackId) return;
  const safeSessionId = String(sessionId || `${trackId}-${Date.now()}`).trim();
  if (!safeSessionId) return;
  if (activeSession && matchesActiveSession(trackId, sessionId)) {
    return;
  }
  if (activeSession && !matchesActiveSession(trackId, sessionId)) {
    await stopActiveSession('replaced-by-new-request', { notifyBackend: true });
  }
  setScreenShareState(SCREEN_SHARE_STATES.REQUESTED, { trackId, sessionId: safeSessionId, mediaType });
  await startScreenShare({ trackId, intervalMs, sessionId: safeSessionId, skipTransport: true });
  activeSession = { trackId, sessionId: safeSessionId, mediaType, intervalMs, startedAtMs: Date.now() };
  await startWebRTCScreenShareSession({
    trackId,
    sessionId: safeSessionId,
    mediaType,
    offerTimeoutMs: DEFAULT_OFFER_TIMEOUT_MS,
    onStateChange: (state) => setScreenShareState(state),
    onConnected: () => setScreenShareState(SCREEN_SHARE_STATES.CONNECTED),
    onError: onWebRTCSessionError,
    onEnded: () => stopActiveSession('session-ended', { notifyBackend: false }),
  });
  clearWaitingOfferTimer();
  waitingOfferTimer = setTimeout(() => {
    stopActiveSession('offer-timeout', { notifyBackend: true });
  }, DEFAULT_OFFER_TIMEOUT_MS);
}

async function handleSessionRequested(payload) {
  const trackId = await resolveTrackId();
  if (!trackId) return;
  const parsed = normalizeSessionPayload(payload);
  if (!parsed.trackId || parsed.trackId !== trackId) return;
  await startRequestedSession(parsed);
}

async function handleSignal(payload) {
  const parsed = normalizeSessionPayload(payload);
  console.log('ScreenShareService: webrtc-signal received', {
    trackId: parsed.trackId,
    sessionId: parsed.sessionId,
    signalType: parsed.signalType,
    senderType: parsed.senderType,
    hasSdp: Boolean(parsed.sdp),
    hasCandidate: Boolean(parsed.candidate),
  });
  if (!parsed.trackId || !parsed.signalType) return;
  if (
    !activeSession &&
    parsed.signalType === 'offer' &&
    parsed.senderType === 'parent' &&
    parsed.sessionId
  ) {
    await startRequestedSession({
      trackId: parsed.trackId,
      sessionId: parsed.sessionId,
      mediaType: parsed.mediaType,
      intervalMs: parsed.intervalMs,
    });
  }
  if (!matchesActiveSession(parsed.trackId, parsed.sessionId)) return;
  if (parsed.senderType && parsed.senderType !== 'parent') return;
  await processWebRTCSignal({
    ...parsed,
    sessionId: parsed.sessionId || activeSession?.sessionId || '',
  });
}

async function handleSessionStopped(payload) {
  const parsed = normalizeSessionPayload(payload);
  if (!matchesActiveSession(parsed.trackId, parsed.sessionId)) return;
  await stopActiveSession('parent-stopped', { notifyBackend: false });
}

function getPusherConfig() {
  const cfg = pusherConfigOverride || global?.__KTO_PUSHER_CONFIG__ || {};
  const key = String(cfg.key || '').trim();
  const cluster = String(cfg.cluster || '').trim();
  const host = String(cfg.host || '').trim();
  const wsPort = Number(cfg.wsPort || 80);
  const wssPort = Number(cfg.wssPort || 443);
  const forceTLS = cfg.forceTLS !== false;
  const enabledTransports = Array.isArray(cfg.enabledTransports)
    ? cfg.enabledTransports
    : ['ws', 'wss'];
  if (!key) return null;
  return {
    key,
    cluster: cluster || undefined,
    wsHost: host || undefined,
    wsPort,
    wssPort,
    forceTLS,
    enabledTransports,
  };
}

export function configureScreenShareRealtime(config) {
  pusherConfigOverride = config && typeof config === 'object' ? { ...config } : null;
}

async function ensureRealtimeSubscription() {
  const channelName = await resolveFamilyChannelName();
  if (!channelName) return;
  const cfg = getPusherConfig();
  if (!cfg) {
    console.warn('ScreenShareService: Pusher config missing; realtime disabled');
    return;
  }
  console.log('ScreenShareService: subscribing realtime channel', channelName);
  if (realtimeClient && currentFamilyChannelName === channelName) return;

  if (realtimeChannel) {
    realtimeChannel.unbind_all?.();
    realtimeClient?.unsubscribe(currentFamilyChannelName);
    realtimeChannel = null;
  }
  if (!realtimeClient) {
    realtimeClient = new Pusher(cfg.key, {
      cluster: cfg.cluster,
      wsHost: cfg.wsHost,
      wsPort: cfg.wsPort,
      wssPort: cfg.wssPort,
      forceTLS: cfg.forceTLS,
      enabledTransports: cfg.enabledTransports,
    });
  }
  currentFamilyChannelName = channelName;
  realtimeChannel = realtimeClient.subscribe(channelName);

  const bindDedup = (eventName, handler) => {
    realtimeChannel.bind(eventName, async (payload) => {
      const dedupKey = buildEventKey(eventName, payload);
      if (seenEventKeys.has(dedupKey)) return;
      seenEventKeys.add(dedupKey);
      if (seenEventKeys.size > 400) {
        const first = seenEventKeys.values().next()?.value;
        if (first) seenEventKeys.delete(first);
      }
      await handler(payload).catch((e) => {
        console.warn(`ScreenShareService: ${eventName} handler failed`, e?.message || e);
      });
    });
  };

  bindDedup('webrtc-session-requested', handleSessionRequested);
  bindDedup('webrtc-signal', handleSignal);
  bindDedup('webrtc-session-stopped', handleSessionStopped);
}

function normalizeIntervalMs(intervalMs) {
  const parsed = Number(intervalMs);
  if (!Number.isFinite(parsed)) return 2500;
  return Math.min(60000, Math.max(500, Math.round(parsed)));
}

async function resolveTrackId(overrideTrackId) {
  const direct = String(overrideTrackId || '').trim();
  if (direct) return direct;
  return String((await AsyncStorage.getItem('trackid')) || '').trim();
}

async function syncScreenShareState(trackId, active, intervalMs) {
  if (!trackId) return null;
  const payload = { trackId, active: Boolean(active) };
  if (intervalMs != null) payload.intervalMs = normalizeIntervalMs(intervalMs);
  return instance.post('/screen-share', payload);
}

export async function startScreenShare({
  trackId,
  intervalMs = 2500,
  sessionId = '',
  skipTransport = false,
} = {}) {
  if (Platform.OS !== 'android') {
    throw new Error('Screen share is currently implemented for Android only');
  }
  if (!ScreenShareModule?.startScreenShare) {
    throw new Error('ScreenShareModule is not available');
  }

  const resolvedTrackId = await resolveTrackId(trackId);
  if (!resolvedTrackId) {
    throw new Error('No trackId found; device may not be linked');
  }

  if (ScreenCaptureModule?.hasScreenCaptureConsent) {
    const consent = await ScreenCaptureModule.hasScreenCaptureConsent();
    if (!consent) {
      throw new Error('Screen-capture consent is required before starting screen share');
    }
  }

  const safeIntervalMs = normalizeIntervalMs(intervalMs);
  const safeSessionId = String(sessionId || `${resolvedTrackId}-${Date.now()}`);

  await ScreenShareModule.startScreenShare({
    trackId: resolvedTrackId,
    intervalMs: safeIntervalMs,
  });
  if (!skipTransport) {
    try {
      await startWebRTCScreenShareSession({
        trackId: resolvedTrackId,
        sessionId: safeSessionId,
        mediaType: 'screen',
        onStateChange: setScreenShareState,
        onConnected: () => setScreenShareState(SCREEN_SHARE_STATES.CONNECTED),
        onError: onWebRTCSessionError,
      });
    } catch (e) {
      // Keep foreground service in sync with media setup result.
      await ScreenShareModule.stopScreenShare().catch(() => {});
      throw new Error(`Screen share transport failed: ${e?.message || e}`);
    }
  }
  await syncScreenShareState(resolvedTrackId, true, safeIntervalMs).catch((e) => {
    console.warn('startScreenShare: backend sync failed', e?.message || e);
  });
  return { trackId: resolvedTrackId, active: true, intervalMs: safeIntervalMs };
}

export async function stopScreenShare({ trackId } = {}) {
  if (Platform.OS !== 'android') return { active: false };
  if (!ScreenShareModule?.stopScreenShare) {
    throw new Error('ScreenShareModule is not available');
  }

  const resolvedTrackId = await resolveTrackId(trackId);
  await stopWebRTCScreenShareSession().catch(() => {});
  await ScreenShareModule.stopScreenShare();
  await syncScreenShareState(resolvedTrackId, false).catch((e) => {
    console.warn('stopScreenShare: backend sync failed', e?.message || e);
  });
  return { trackId: resolvedTrackId, active: false };
}

export async function getScreenShareState({ trackId } = {}) {
  const local =
    (await ScreenShareModule?.getScreenShareState?.().catch(() => null)) || {
      active: false,
      trackId: '',
      intervalMs: 0,
      updatedAtMs: 0,
    };
  const resolvedTrackId = await resolveTrackId(trackId);
  if (!resolvedTrackId) return local;

  try {
    const res = await instance.get(`/screen-share/${encodeURIComponent(resolvedTrackId)}`);
    const data = res?.data?.data || res?.data || {};
    return {
      active: Boolean(data?.active ?? local.active),
      trackId: String(data?.trackId || resolvedTrackId),
      intervalMs: normalizeIntervalMs(data?.intervalMs ?? local.intervalMs ?? 2500),
      revision: String(data?.revision || ''),
      updatedAt: data?.updatedAt || '',
      updatedAtMs: Number(local.updatedAtMs || 0),
    };
  } catch {
    return local;
  }
}

async function runtimeTick() {
  if (runtimeInFlight) return;
  runtimeInFlight = true;
  try {
    await ensureRealtimeSubscription();
    const state = await getScreenShareState({});
    if (!state?.active && activeSession) {
      await stopActiveSession('backend-state-inactive', { notifyBackend: false });
    }

    if (activeSession) {
      const nextRevision = String(state?.revision || '').trim();
      if (nextRevision && remoteRevisionSeen && nextRevision !== remoteRevisionSeen) {
        // Revision changed but realtime event could have been missed.
        await stopActiveSession('revision-changed', { notifyBackend: false });
      }
      remoteRevisionSeen = nextRevision || remoteRevisionSeen;
    }
  } catch (e) {
    console.warn('ScreenShareService: runtime tick failed', e?.message || e);
  } finally {
    runtimeInFlight = false;
  }
}

export function initScreenShareRuntime() {
  if (Platform.OS !== 'android') return () => {};
  if (runtimeTickTimer) return () => {};
  runtimeTickTimer = setInterval(runtimeTick, SCREEN_SHARE_RUNTIME_TICK_MS);
  appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      runtimeTick();
      return;
    }
    if (activeSession) {
      stopActiveSession('app-backgrounded', { notifyBackend: true }).catch(() => {});
    }
  });
  runtimeTick();
  return () => {
    if (runtimeTickTimer) {
      clearInterval(runtimeTickTimer);
      runtimeTickTimer = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
    clearWaitingOfferTimer();
    if (realtimeChannel) {
      realtimeChannel.unbind_all?.();
      if (realtimeClient && currentFamilyChannelName) {
        realtimeClient.unsubscribe(currentFamilyChannelName);
      }
      realtimeChannel = null;
    }
    if (realtimeClient) {
      realtimeClient.disconnect();
      realtimeClient = null;
    }
    currentFamilyChannelName = '';
  };
}

export function getScreenShareRuntimeState() {
  return {
    state: activeState,
    hasSession: Boolean(activeSession),
    trackId: activeSession?.trackId || '',
    sessionId: activeSession?.sessionId || '',
  };
}

