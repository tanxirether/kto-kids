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
  getWebRTCScreenShareHealth,
} from './ScreenShareWebRTC';

const ScreenShareModule = NativeModules?.ScreenShareModule;
const ScreenCaptureModule = NativeModules?.ScreenCaptureModule;
const SCREEN_SHARE_RUNTIME_TICK_MS = 15000;
const DEFAULT_OFFER_TIMEOUT_MS = 30000;
const SESSION_REQUEST_EVENTS = ['webrtc-session-requested', 'webrtc_session_requested', 'screen-share-requested'];
const SIGNAL_EVENTS = ['webrtc-signal', 'webrtc_signal', 'screen-share-signal', 'screen_share_signal'];
const SESSION_STOP_EVENTS = ['webrtc-session-stopped', 'webrtc_session_stopped', 'screen-share-stopped'];
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
let realtimeChannels = new Map();
let currentRealtimeChannelNames = [];
let appStateSubscription = null;
let activeSession = null;
let activeState = SCREEN_SHARE_STATES.IDLE;
const seenEventKeys = new Set();
let waitingOfferTimer = null;
let offerRecoveryTimer = null;
let remoteRevisionSeen = '';
let pusherConfigOverride = null;
const PusherClientCtor = Pusher?.Pusher || Pusher;
const STATUS_SESSION_CACHE_TTL_MS = 10000;
const statusSessionCache = new Map();
let statusSessionFetchBlockedUntilMs = 0;
let lastStatusSessionWarnAtMs = 0;

function setScreenShareState(nextState, extra = {}) {
  activeState = String(nextState || SCREEN_SHARE_STATES.IDLE);
  console.log('ScreenShareService: state ->', activeState, extra);
}

function safeJsonParse(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeSessionPayload(payload) {
  const payloadObj =
    (payload && typeof payload === 'object' ? payload : null) || safeJsonParse(payload) || {};
  const resolvedData =
    (payloadObj.data && typeof payloadObj.data === 'object'
      ? payloadObj.data
      : safeJsonParse(payloadObj.data)) || payloadObj;
  const root = resolvedData && typeof resolvedData === 'object' ? resolvedData : {};
  const data = root.data && typeof root.data === 'object' ? root.data : root;
  const signal = data.signal && typeof data.signal === 'object' ? data.signal : {};
  const trackId = String(
    data.trackId ||
      data.track_id ||
      signal.trackId ||
      signal.track_id ||
      root.trackId ||
      root.track_id ||
      '',
  ).trim();
  const sessionId = String(
    data.sessionId ||
      data.session_id ||
      signal.sessionId ||
      signal.session_id ||
      root.sessionId ||
      root.session_id ||
      '',
  ).trim();
  const mediaType = String(
    data.mediaType ||
      data.media_type ||
      signal.mediaType ||
      signal.media_type ||
      root.mediaType ||
      root.media_type ||
      'screen',
  )
    .trim()
    .toLowerCase();
  const intervalMs = normalizeIntervalMs(data.intervalMs ?? data.interval_ms ?? 2500);
  const rawSignalType = data.signalType || data.signal_type || data.type || signal.type || '';
  const signalType = String(rawSignalType).trim().toLowerCase().replace(/_/g, '-');
  const source = String(
    data.senderType ||
      data.sender_type ||
      data.sender ||
      signal.senderType ||
      signal.sender_type ||
      signal.sender ||
      root.senderType ||
      root.sender_type ||
      root.sender ||
      '',
  )
    .trim()
    .toLowerCase();
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

function clearOfferRecoveryTimer() {
  if (offerRecoveryTimer) {
    clearInterval(offerRecoveryTimer);
    offerRecoveryTimer = null;
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

async function resolveActiveSessionIdFromStatus(trackId) {
  const safeTrackId = String(trackId || '').trim();
  if (!safeTrackId) return '';
  const now = Date.now();
  if (statusSessionFetchBlockedUntilMs > now) {
    return '';
  }
  const cached = statusSessionCache.get(safeTrackId);
  if (cached && now - cached.atMs <= STATUS_SESSION_CACHE_TTL_MS) {
    return String(cached.sessionId || '');
  }
  try {
    const res = await instance.get(`/screen-share/webrtc/status/${encodeURIComponent(safeTrackId)}`);
    const data = res?.data?.data || {};
    const sessionId = String(data?.sessionId || '').trim();
    const active = Boolean(data?.active);
    const status = String(data?.status || '').trim().toLowerCase();
    if (active && sessionId && status !== 'stopped') {
      statusSessionCache.set(safeTrackId, { sessionId, atMs: now });
      console.log('ScreenShareService: status session resolved', {
        trackId: safeTrackId,
        sessionId,
        status,
      });
      return sessionId;
    }
  } catch (e) {
    const statusCode = Number(e?.response?.status || 0);
    if (statusCode === 401 || statusCode === 403) {
      // Child build may not be authorized for this endpoint; avoid noisy retries.
      statusSessionFetchBlockedUntilMs = now + 5 * 60 * 1000;
    }
    if (now - lastStatusSessionWarnAtMs < 30000) {
      return '';
    }
    lastStatusSessionWarnAtMs = now;
    console.warn('ScreenShareService: status session resolve failed', {
      trackId: safeTrackId,
      statusCode,
      message: e?.message || String(e || ''),
    });
  }
  return '';
}

async function resolveLatestOfferFromBackend(trackId) {
  const safeTrackId = String(trackId || '').trim();
  if (!safeTrackId) return null;
  try {
    const res = await instance.get(`/screen-share/webrtc/latest-offer/${encodeURIComponent(safeTrackId)}`);
    const data = res?.data?.data || {};
    const parsed = normalizeSessionPayload(data);
    const sdp = String(parsed.sdp || '').trim();
    if (!parsed.sessionId || !sdp) return null;
    return {
      ...parsed,
      trackId: parsed.trackId || safeTrackId,
      signalType: 'offer',
      senderType: parsed.senderType || 'parent',
      sdp,
    };
  } catch (e) {
    const statusCode = Number(e?.response?.status || 0);
    // 404 just means no latest offer yet, do not spam.
    if (statusCode !== 404) {
      console.warn('ScreenShareService: latest offer fallback failed', {
        trackId: safeTrackId,
        statusCode,
        message: e?.message || String(e || ''),
      });
    }
    return null;
  }
}

async function resolveFamilyChannelName() {
  const familyId = String((await AsyncStorage.getItem('familyId')) || '').trim();
  if (!familyId) return '';
  return `family_${familyId}`;
}

async function resolveRealtimeChannelNames() {
  const names = new Set();
  const familyChannel = await resolveFamilyChannelName();
  const trackId = await resolveTrackId();
  if (familyChannel) names.add(familyChannel);
  if (trackId) {
    names.add(`track_${trackId}`);
    names.add(`screen_share_${trackId}`);
    names.add(`screen-share_${trackId}`);
    names.add(`screen-share-${trackId}`);
    names.add(`screen_share-${trackId}`);
  }
  return Array.from(names);
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
  console.log('ScreenShareService: stop/cleanup', {
    reason,
    trackId: activeSession?.trackId,
    sessionId: activeSession?.sessionId,
    notifyBackend,
  });
  setScreenShareState(SCREEN_SHARE_STATES.ENDING, { reason });
  clearWaitingOfferTimer();
  clearOfferRecoveryTimer();
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
  console.log('ScreenShareService: request received', {
    trackId,
    sessionId: safeSessionId,
    mediaType,
    intervalMs,
  });
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
  clearOfferRecoveryTimer();
  offerRecoveryTimer = setInterval(() => {
    if (!activeSession) return;
    if (activeState !== SCREEN_SHARE_STATES.WAITING_OFFER) return;
    resolveLatestOfferFromBackend(activeSession.trackId)
      .then(async (offerPayload) => {
        if (!offerPayload) return;
        if (!matchesActiveSession(offerPayload.trackId, offerPayload.sessionId)) return;
        console.log('ScreenShareService: applying latest-offer fallback', {
          trackId: offerPayload.trackId,
          sessionId: offerPayload.sessionId,
        });
        await processWebRTCSignal({
          ...offerPayload,
          sessionId: offerPayload.sessionId || activeSession?.sessionId || '',
          trackId: offerPayload.trackId || activeSession?.trackId || '',
        });
      })
      .catch(() => {});
  }, 3000);
  waitingOfferTimer = setTimeout(() => {
    stopActiveSession('offer-timeout', { notifyBackend: true });
  }, DEFAULT_OFFER_TIMEOUT_MS);
}

async function handleSessionRequested(payload) {
  const trackId = await resolveTrackId();
  if (!trackId) return;
  const parsed = normalizeSessionPayload(payload);
  if (!parsed.sessionId && parsed.trackId === trackId) {
    parsed.sessionId = await resolveActiveSessionIdFromStatus(trackId);
  }
  if (!parsed.trackId || parsed.trackId !== trackId) return;
  await startRequestedSession(parsed);
  // Some backends send the initial offer embedded in session-requested event.
  if (parsed.signalType === 'offer' && parsed.sdp) {
    console.log('ScreenShareService: embedded offer found in session-requested', {
      trackId: parsed.trackId,
      sessionId: parsed.sessionId,
    });
    await processWebRTCSignal({
      ...parsed,
      sessionId: parsed.sessionId || activeSession?.sessionId || '',
      trackId: parsed.trackId || activeSession?.trackId || '',
    }).catch((e) => {
      console.warn('ScreenShareService: embedded offer process failed', e?.message || e);
    });
  }
}

async function handleSignal(payload) {
  const localTrackId = await resolveTrackId();
  const parsed = normalizeSessionPayload(payload);
  if (!parsed.trackId && localTrackId) {
    parsed.trackId = localTrackId;
  }
  if (!parsed.sessionId && parsed.trackId && localTrackId && parsed.trackId === localTrackId) {
    parsed.sessionId = await resolveActiveSessionIdFromStatus(parsed.trackId);
  }
  console.log('ScreenShareService: webrtc-signal received', {
    trackId: parsed.trackId,
    sessionId: parsed.sessionId,
    signalType: parsed.signalType,
    senderType: parsed.senderType,
    hasSdp: Boolean(parsed.sdp),
    hasCandidate: Boolean(parsed.candidate),
  });
  if (!parsed.trackId || !parsed.signalType) return;
  if (!localTrackId || parsed.trackId !== localTrackId) {
    console.log('ScreenShareService: signal ignored (track mismatch)', {
      localTrackId,
      incomingTrackId: parsed.trackId,
      sessionId: parsed.sessionId,
      signalType: parsed.signalType,
    });
    return;
  }
  const sender = String(parsed.senderType || '').toLowerCase();
  if (
    !activeSession &&
    parsed.signalType === 'offer' &&
    sender !== 'child' &&
    parsed.sessionId
  ) {
    console.log('ScreenShareService: offer-triggered session bootstrap', {
      trackId: parsed.trackId,
      sessionId: parsed.sessionId,
      senderType: sender || 'unknown',
    });
    await startRequestedSession({
      trackId: parsed.trackId,
      sessionId: parsed.sessionId,
      mediaType: parsed.mediaType,
      intervalMs: parsed.intervalMs,
    });
  }
  if (!matchesActiveSession(parsed.trackId, parsed.sessionId)) return;
  if (sender && sender !== 'parent') {
    console.log('ScreenShareService: signal ignored (sender not parent)', {
      senderType: sender,
      sessionId: parsed.sessionId,
      signalType: parsed.signalType,
    });
    return;
  }
  await processWebRTCSignal({
    ...parsed,
    sessionId: parsed.sessionId || activeSession?.sessionId || '',
  });
}

async function handleSessionStopped(payload) {
  const parsed = normalizeSessionPayload(payload);
  if (!parsed.sessionId && parsed.trackId) {
    parsed.sessionId = await resolveActiveSessionIdFromStatus(parsed.trackId);
  }
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
  const channelNames = await resolveRealtimeChannelNames();
  if (!Array.isArray(channelNames) || channelNames.length === 0) {
    console.warn('ScreenShareService: no channel target (familyId/trackId missing)');
    return;
  }
  const cfg = getPusherConfig();
  if (!cfg) {
    console.warn('ScreenShareService: Pusher config missing; realtime disabled');
    return;
  }
  const sameChannels =
    channelNames.length === currentRealtimeChannelNames.length &&
    channelNames.every((name) => currentRealtimeChannelNames.includes(name));
  if (realtimeClient && sameChannels) return;

  console.log('ScreenShareService: subscribing realtime channels', channelNames.join(', '));

  for (const [name, channel] of realtimeChannels.entries()) {
    channel.unbind_all?.();
    realtimeClient?.unsubscribe(name);
  }
  realtimeChannels = new Map();

  if (!realtimeClient) {
    if (typeof PusherClientCtor !== 'function') {
      throw new Error('Pusher client constructor is unavailable');
    }
    realtimeClient = new PusherClientCtor(cfg.key, {
      cluster: cfg.cluster,
      wsHost: cfg.wsHost,
      wsPort: cfg.wsPort,
      wssPort: cfg.wssPort,
      forceTLS: cfg.forceTLS,
      enabledTransports: cfg.enabledTransports,
    });
  }
  currentRealtimeChannelNames = channelNames;

  const bindDedup = (eventName, handler) => {
    for (const name of channelNames) {
      const channel = realtimeClient.subscribe(name);
      realtimeChannels.set(name, channel);
      channel.bind('pusher:subscription_succeeded', () => {
        console.log('ScreenShareService: subscribed', { channel: name, eventName });
      });
      channel.bind('pusher:subscription_error', (err) => {
        console.warn('ScreenShareService: subscription error', { channel: name, eventName, err });
      });
      channel.bind(eventName, async (payload) => {
        const dedupKey = `${name}|${buildEventKey(eventName, payload)}`;
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
    }
  };

  SESSION_REQUEST_EVENTS.forEach((eventName) => bindDedup(eventName, handleSessionRequested));
  SIGNAL_EVENTS.forEach((eventName) => bindDedup(eventName, handleSignal));
  SESSION_STOP_EVENTS.forEach((eventName) => bindDedup(eventName, handleSessionStopped));
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
  const currentSessionId = activeSession?.sessionId || '';
  await stopWebRTCScreenShareSession().catch(() => {});
  await ScreenShareModule.stopScreenShare();
  if (resolvedTrackId && currentSessionId) {
    await stopWebRTCScreenShareRemotely({
      trackId: resolvedTrackId,
      sessionId: currentSessionId,
      reason: 'child-ended',
    }).catch(() => {});
  }
  await syncScreenShareState(resolvedTrackId, false).catch((e) => {
    console.warn('stopScreenShare: backend sync failed', e?.message || e);
  });
  if (activeSession && String(activeSession.trackId) === String(resolvedTrackId)) {
    activeSession = null;
  }
  clearWaitingOfferTimer();
  clearOfferRecoveryTimer();
  setScreenShareState(SCREEN_SHARE_STATES.IDLE, { reason: 'child-ended' });
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
    const localTrackId = await resolveTrackId();
    if (!activeSession && state?.active && localTrackId) {
      const recoveredSessionId = await resolveActiveSessionIdFromStatus(localTrackId);
      if (recoveredSessionId) {
        console.log('ScreenShareService: recovering active session from status', {
          trackId: localTrackId,
          sessionId: recoveredSessionId,
        });
        await startRequestedSession({
          trackId: localTrackId,
          sessionId: recoveredSessionId,
          mediaType: 'screen',
          intervalMs: state?.intervalMs || 2500,
        });
      }
    }
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
    clearOfferRecoveryTimer();
    for (const [name, channel] of realtimeChannels.entries()) {
      channel.unbind_all?.();
      if (realtimeClient) {
        realtimeClient.unsubscribe(name);
      }
    }
    realtimeChannels = new Map();
    if (realtimeClient) {
      realtimeClient.disconnect();
      realtimeClient = null;
    }
    currentRealtimeChannelNames = [];
  };
}

export function getScreenShareRuntimeState() {
  return {
    state: activeState,
    hasSession: Boolean(activeSession),
    trackId: activeSession?.trackId || '',
    sessionId: activeSession?.sessionId || '',
    webrtc: getWebRTCScreenShareHealth(),
  };
}

