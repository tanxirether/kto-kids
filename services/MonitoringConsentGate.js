import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISCLOSURE_STORAGE_KEY } from '../constants/monitoringDisclosure';

let gateRef = null;

export function registerMonitoringGate(gate) {
  gateRef = gate;
}

export async function hasMonitoringConsent() {
  try {
    return (await AsyncStorage.getItem(DISCLOSURE_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Call after user accepts prominent disclosure so services start immediately. */
export async function notifyMonitoringConsentGranted() {
  await gateRef?.start();
}

/** Start monitoring-related services only after prominent disclosure consent. */
export function createMonitoringGate(startFn) {
  let started = false;
  let stopFn = null;

  const start = async () => {
    if (started) return stopFn;
    const ok = await hasMonitoringConsent();
    if (!ok) return null;
    stopFn = startFn();
    started = true;
    return stopFn;
  };

  const stop = () => {
    stopFn?.();
    stopFn = null;
    started = false;
  };

  const gate = { start, stop };
  registerMonitoringGate(gate);
  return gate;
}
