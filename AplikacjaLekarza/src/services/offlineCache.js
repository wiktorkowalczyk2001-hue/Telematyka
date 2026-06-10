import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  patients: 'offline_patients',
  visits: 'offline_visits',
  users: 'offline_users',
  medicalDocs: 'offline_medical_documents',
  pending: 'offline_pending_ops',
  lastSynced: 'offline_last_synced',
  cacheSize: 'offline_cache_size',
};

// Max cache size: 5MB (AsyncStorage safety limit ~8MB, but we use 5MB for safety)
const MAX_CACHE_SIZE = 5 * 1024 * 1024;

export const getCache = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(KEYS[key]);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setCache = async (key, data) => {
  try {
    const serialized = JSON.stringify(data);
    const size = new Blob([serialized]).size;

    // Check if adding this would exceed limit
    if (size > MAX_CACHE_SIZE) {
      console.warn(`Cache item '${key}' is too large (${size} bytes). Skipping cache.`);
      return;
    }

    await AsyncStorage.setItem(KEYS[key], serialized);
    // Track cache size
    const totalSize = await calculateCacheSize();
    await AsyncStorage.setItem(KEYS.cacheSize, totalSize.toString());
  } catch (e) {
    console.error(`Failed to set cache for '${key}':`, e);
  }
};

export const calculateCacheSize = async () => {
  let totalSize = 0;
  for (const key of Object.values(KEYS)) {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) totalSize += new Blob([data]).size;
    } catch {}
  }
  return totalSize;
};

export const clearCacheIfNeeded = async () => {
  const size = await calculateCacheSize();
  if (size > MAX_CACHE_SIZE * 0.9) {
    // Clear medical_documents cache first (usually largest)
    try {
      await AsyncStorage.removeItem(KEYS.medicalDocs);
      console.log('Cleared medical documents cache to free space');
    } catch {}
  }
};

export const queuePendingOp = async (op) => {
  const existing = (await getCache('pending')) || [];
  const newOp = {
    ...op,
    _id: Date.now() + Math.random(),
    _createdAt: Date.now(),
    _table: op._table || 'unknown', // Track which table this op is for
  };
  existing.push(newOp);
  await setCache('pending', existing);
};

export const getPendingOps = async () => (await getCache('pending')) || [];
export const setPendingOps = async (ops) => setCache('pending', ops);

// Get pending ops for specific table
export const getPendingOpsByTable = async (table) => {
  const ops = await getPendingOps();
  return ops.filter(op => op._table === table);
};

export const removePendingOp = async (opId) => {
  const ops = await getPendingOps();
  const filtered = ops.filter(op => op._id !== opId);
  await setPendingOps(filtered);
};

export const isNetworkError = (e) =>
  e?.name === 'AbortError' ||
  e?.message?.includes('Failed to fetch') ||
  e?.message?.includes('Network request failed') ||
  e?.message?.includes('NetworkError') ||
  e?.message?.includes('fetch');

// Helper: prepare data for offline storage
// Decrypts sensitive fields locally before caching
export const prepareForOfflineCache = (data, dataType) => {
  if (!data) return data;

  switch (dataType) {
    case 'patient':
      // Already decrypted by backend - store as-is
      return data;
    case 'visit':
      return data;
    case 'medicalDoc':
      // Don't cache the actual file content, just metadata
      return {
        id: data.id,
        patientId: data.patient_id,
        fileName: data.file_name,
        fileType: data.file_type,
        storagePath: data.storage_path,
        description: data.description,
        createdAt: data.created_at,
        // Skip: actual binary file content
      };
    default:
      return data;
  }
};

// Sync helper: determine what operations need sync
export const getSyncQueue = async () => {
  const pendingOps = await getPendingOps();
  return {
    patients: pendingOps.filter(op => op._table === 'patients'),
    visits: pendingOps.filter(op => op._table === 'visits'),
    medicalDocs: pendingOps.filter(op => op._table === 'medical_documents'),
  };
};
