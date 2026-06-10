import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCache, setCache, getPendingOps, setPendingOps } from '../services/offlineCache';

const API_URL = 'http://192.168.0.31:3001';

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
  const [pRes, vRes] = await Promise.all([
    fetch(`${API_URL}/patients?order=last_name.asc,first_name.asc`),
    fetch(`${API_URL}/visits?select=*,patients(first_name,last_name,age,pesel)&order=visit_date.desc,visit_time.asc`),
  ]);
  if (pRes.ok) await setCache('patients', await pRes.json());
  if (vRes.ok) await setCache('visits', await vRes.json());
}

async function flushPending() {
  const ops = await getPendingOps();
  if (!ops.length) return;
  const failed = [];
  for (const op of ops) {
    try {
      const r = await fetch(op.url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: op.body,
      });
      if (!r.ok) failed.push(op);
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

  const refreshPending = useCallback(async () => {
    const ops = await getPendingOps();
    setPendingCount(ops.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
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

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });
    return () => sub.remove();
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, lastSynced, pendingCount, syncNow }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
