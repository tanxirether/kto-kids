import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'handled_command_ids_v1';
const MAX_IDS = 200;
const TTL_MS = 24 * 60 * 60 * 1000;

let _cache = null;

function nowMs() {
  return Date.now();
}

function pruneEntries(entries, now = nowMs()) {
  const arr = Array.isArray(entries) ? entries : [];
  const filtered = arr.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.id !== 'string' || !e.id.trim()) return false;
    if (typeof e.tsMs !== 'number' || e.tsMs <= 0) return false;
    return now - e.tsMs < TTL_MS;
  });
  filtered.sort((a, b) => b.tsMs - a.tsMs);
  return filtered.slice(0, MAX_IDS);
}

async function ensureLoaded() {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    _cache = pruneEntries(parsed);
    return _cache;
  } catch {
    _cache = [];
    return _cache;
  }
}

async function persist(entries) {
  const clean = pruneEntries(entries);
  _cache = clean;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // best effort: dedup still works for current process using _cache
  }
}

/**
 * Returns true if this ID was already handled in last TTL window.
 * If not seen, records it and returns false.
 */
export async function wasCommandHandled(commandId) {
  const id = typeof commandId === 'string' ? commandId.trim() : '';
  if (!id) return false;

  const entries = await ensureLoaded();
  if (entries.some((e) => e.id === id)) {
    return true;
  }

  await persist([{ id, tsMs: nowMs() }, ...entries]);
  return false;
}
