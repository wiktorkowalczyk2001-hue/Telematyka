import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  patients: 'offline_patients',
  visits: 'offline_visits',
  pending: 'offline_pending_ops',
  lastSynced: 'offline_last_synced',
};

export const getCache = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS[key]);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setCache = async (key, data) => {
  try { await AsyncStorage.setItem(KEYS[key], JSON.stringify(data)); } catch {}
};

export const queuePendingOp = async (op) => {
  const existing = (await getCache('pending')) || [];
  existing.push({ ...op, _id: Date.now() + Math.random(), _createdAt: Date.now() });
  await setCache('pending', existing);
};

export const getPendingOps = async () => (await getCache('pending')) || [];
export const setPendingOps = async (ops) => setCache('pending', ops);

export const isNetworkError = (e) =>
  e?.name === 'AbortError' ||
  e?.message?.includes('Failed to fetch') ||
  e?.message?.includes('Network request failed') ||
  e?.message?.includes('NetworkError') ||
  e?.message?.includes('fetch');
