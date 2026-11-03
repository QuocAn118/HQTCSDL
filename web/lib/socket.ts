// Vong doi Socket.IO (spec web 2.4). Ham phan loai la ham thuan de test; createLiveSocket dung socket.io-client.
import { io, type Socket } from 'socket.io-client';

export const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

export function backoffDelay(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

export function classifyConnectError(err: { data?: { code?: string } } | null | undefined): 'logout' | 'retry' {
  return err?.data?.code === 'UNAUTHENTICATED' ? 'logout' : 'retry';
}

// 'io server disconnect' = server chu dong ngat (khoa tai khoan, doi vai tro, token het han) -> dang xuat.
export function classifyDisconnect(reason: string): 'logout' | 'none' | 'reconnecting' {
  if (reason === 'io server disconnect') return 'logout';
  if (reason === 'io client disconnect') return 'none';
  return 'reconnecting';
}

export type LiveStatus = 'connecting' | 'connected' | 'reconnecting';

export interface LiveHandlers {
  [event: string]: (payload: never) => void;
}

export interface LiveOptions {
  url: string;
  getToken: () => string | null;
  onLogout: () => void;
  onStatus: (s: LiveStatus) => void;
  onConnect: () => void;
  handlers: LiveHandlers;
}

export function createLiveSocket(o: LiveOptions): { close: () => void } {
  // auth dang ham: moi lan ket noi (lai) doc token hien tai trong sessionStorage.
  const socket: Socket = io(o.url, { autoConnect: false, auth: (cb) => cb({ token: o.getToken() }) });
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  // Nghe su kien TRUOC khi ket noi (hop dong 4.1).
  for (const [event, fn] of Object.entries(o.handlers)) socket.on(event, fn as (p: unknown) => void);
  socket.on('connect', () => {
    attempt = 0;
    o.onStatus('connected');
    o.onConnect();
  });
  socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
    if (closed) return;
    if (classifyConnectError(err) === 'logout') {
      o.onLogout();
      return;
    }
    o.onStatus('reconnecting');
    // socket.active = false: middleware server tu choi, Socket.IO khong tu thu lai -> tu goi connect() gian dan.
    if (!socket.active) timer = setTimeout(() => socket.connect(), backoffDelay(attempt++));
  });
  socket.on('disconnect', (reason) => {
    const action = classifyDisconnect(reason);
    if (action === 'logout' && !closed) o.onLogout();
    else if (action === 'reconnecting') o.onStatus('reconnecting');
  });
  o.onStatus('connecting');
  socket.connect();

  return {
    close: () => {
      closed = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
