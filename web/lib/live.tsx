'use client';
// Mot ket noi Socket.IO cho trang cua mot nha (layout houses/[houseId]); cac trang con dang ky nghe su kien.
// connectCount tang moi lan connect -> trang tai lai REST roi ghep (spec web 2.4).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { API_URL } from './api';
import { useAuth } from './auth';
import { loadSession } from './session';
import { createLiveSocket, type LiveStatus } from './socket';

export const LIVE_EVENTS = ['readings.new', 'alert.created', 'alert.updated', 'device.state', 'birdcount.updated'] as const;
export type LiveEvent = (typeof LIVE_EVENTS)[number];
type Listener = (event: LiveEvent, payload: unknown) => void;

interface LiveValue { status: LiveStatus; connectCount: number; subscribe: (l: Listener) => () => void }
const LiveContext = createContext<LiveValue | null>(null);

export function useLive(): LiveValue {
  const v = useContext(LiveContext);
  if (!v) throw new Error('useLive phai nam trong LiveProvider');
  return v;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [connectCount, setConnectCount] = useState(0);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const handlers = Object.fromEntries(
      LIVE_EVENTS.map((e) => [e, (payload: unknown) => listeners.current.forEach((l) => l(e, payload))]),
    );
    const live = createLiveSocket({
      url: API_URL,
      getToken: () => loadSession()?.accessToken ?? null,
      onLogout: () => logout('unauthorized'),
      onStatus: setStatus,
      onConnect: () => setConnectCount((n) => n + 1),
      handlers,
    });
    return () => live.close();
  }, [logout]);

  const subscribe = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => {
      listeners.current.delete(l);
    };
  }, []);

  return <LiveContext.Provider value={{ status, connectCount, subscribe }}>{children}</LiveContext.Provider>;
}

// Goi load() khi mount va moi lan socket (ket noi lai).
export function useReloadOnConnect(load: () => unknown): void {
  const { connectCount } = useLive();
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void Promise.resolve(loadRef.current()).catch(() => {});
  }, [connectCount]);
}
