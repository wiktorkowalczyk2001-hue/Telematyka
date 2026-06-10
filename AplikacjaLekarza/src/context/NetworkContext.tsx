import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCache, setCache, getPendingOps, setPendingOps } from '../services/offlineCache';

const API_URL = typeof window !== 'undefined' ? '/api' : 'http://192.168.0.31:3001';

type NetworkContextType = {
  isOnline: boolean;
  lastSynced: number | null;
  pendingCount: number;
  syncNow: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextType>({
  isOnline: false,
  lastSynced: null,
  pendingCount: 0,
  syncNow: async () => {},
});

async function pingServer(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${API_URL}/patients?select=id&limit=1`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

async function pullData() {
  try {
    const [pRes, vRes] = await Promise.all([
      fetch(`${API_URL}/patients?order=last_name.asc,first_name.asc`),
      fetch(`${API_URL}/visits?select=*,patients(first_name,last_name,age,pesel)&order=visit_date.desc,visit_time.asc`),
    ]);
    if (pRes.ok) await setCache('patients', await pRes.json());
    if (vRes.ok) await setCache('visits', await vRes.json());
  } catch {}
}

function deduplicateOps(ops: any[]) {
  const toRemove = new Set<number>();

  // Cancel CREATE + DELETE pairs for same temp ID — resource was never on server
  ops.forEach((delOp, delIdx) => {
    if (delOp.method !== 'DELETE') return;
    const tempMatch = (delOp.url as string).match(/pending_\d+/);
    if (!tempMatch) return;
    const tempId = tempMatch[0];
    ops.forEach((createOp, createIdx) => {
      if (createOp.method === 'POST' && (createOp.tempId === tempId || (createOp.url as string).includes(tempId))) {
        toRemove.add(createIdx);
      }
    });
    toRemove.add(delIdx);
  });

  // For PATCH ops on same URL keep only the last one
  const lastPatch = new Map<string, number>();
  ops.forEach((op, i) => { if (op.method === 'PATCH') lastPatch.set(op.url, i); });
  ops.forEach((op, i) => { if (op.method === 'PATCH' && lastPatch.get(op.url) !== i) toRemove.add(i); });

  return ops.filter((_, i) => !toRemove.has(i));
}

async function flushPending() {
  let ops = await getPendingOps();
  if (!ops.length) return;

  ops = deduplicateOps(ops);

  const failed: any[] = [];
  const idMap: Record<string, string> = {}; // pending_xxx → real server id

  for (const op of ops) {
    // Remap temp IDs in URL to real IDs resolved earlier in this flush
    let url: string = op.url;
    for (const [tempId, realId] of Object.entries(idMap)) {
      url = url.split(tempId).join(realId);
    }

    // Op still references unresolved temp ID → resource never reached server, skip
    if (/pending_\d+/.test(url) && op.method !== 'POST') continue;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (op.method === 'POST') headers['Prefer'] = 'return=representation';

      const r = await fetch(url, {
        method: op.method,
        headers,
        body: op.body ?? undefined,
      });

      if (!r.ok) { failed.push(op); continue; }

      // Successful POST → extract real ID for subsequent ops
      if (op.method === 'POST' && op.tempId) {
        try {
          const data = await r.json();
          const created = Array.isArray(data) ? data[0] : data;
          if (created?.id) idMap[op.tempId] = created.id;
        } catch {}
      }
    } catch {
      failed.push(op);
    }
  }

  await setPendingOps(failed);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncing = useRef(false);
  const syncQueued = useRef(false);

  const refreshPending = useCallback(async () => {
    const ops = await getPendingOps();
    setPendingCount(ops.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current) { syncQueued.current = true; return; }
    syncing.current = true;
    syncQueued.current = false;
    try {
      const online = await pingServer();
      setIsOnline(online);
      if (!online) return;
      await flushPending();
      await pullData();
      const now = Date.now();
      setLastSynced(now);
      await AsyncStorage.setItem('offline_last_synced', now.toString());
      await refreshPending();
    } catch (e) {
      console.error('[Sync]', e);
    } finally {
      syncing.current = false;
      if (syncQueued.current) {
        syncQueued.current = false;
        setTimeout(syncNow, 1000);
      }
    }
  }, [refreshPending]);

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem('offline_last_synced');
      if (stored) setLastSynced(parseInt(stored));
      await refreshPending();
      await syncNow();
    };
    init();

    // Periodic sync every 60s when tab is active
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') syncNow();
    }, 60_000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') syncNow();
    };
    const onOnline = () => syncNow();

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      sub.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, lastSynced, pendingCount, syncNow }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
