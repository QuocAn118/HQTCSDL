import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import {
  API_URL,
  getApiToken,
} from './api';

import {
  INVALID,
  useAuth,
} from './auth';

import {
  createLiveSocket,
  type LiveStatus,
} from './socket';

export const LIVE_EVENTS = [
  'readings.new',
  'alert.created',
  'alert.updated',
  'device.state',
  'birdcount.updated',
] as const;

export type LiveEvent =
  (typeof LIVE_EVENTS)[number];

type Listener = (
  event: LiveEvent,
  payload: unknown
) => void;

interface LiveValue {
  status: LiveStatus;
  connectCount: number;

  subscribe: (
    listener: Listener
  ) => () => void;
}

const LiveContext =
  createContext<LiveValue | null>(
    null
  );

export function useLive() {
  const value =
    useContext(LiveContext);

  if (!value) {
    throw new Error(
      'useLive phai nam trong LiveProvider'
    );
  }

  return value;
}

export function LiveProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { logout } = useAuth();

  const [status, setStatus] =
    useState<LiveStatus>(
      'connecting'
    );

  const [
    connectCount,
    setConnectCount,
  ] = useState(0);

  const [
    foreground,
    setForeground,
  ] = useState(
    AppState.currentState ===
      'active'
  );

  const listeners = useRef(
    new Set<Listener>()
  );

  useEffect(() => {
    const sub =
      AppState.addEventListener(
        'change',
        (state) =>
          setForeground(
            state === 'active'
          )
      );

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!foreground) return;

    const handlers =
      Object.fromEntries(
        LIVE_EVENTS.map((event) => [
          event,
          (payload: unknown) =>
            listeners.current.forEach(
              (listener) =>
                listener(
                  event,
                  payload
                )
            ),
        ])
      );

    const live =
      createLiveSocket({
        url: API_URL,

        getToken: getApiToken,

        onLogout: () =>
          logout(INVALID),

        onStatus: setStatus,

        onConnect: () =>
          setConnectCount(
            (n) => n + 1
          ),

        handlers,
      });

    return () => live.close();
  }, [foreground, logout]);

  const subscribe =
    useCallback(
      (listener: Listener) => {
        listeners.current.add(
          listener
        );

        return () => {
          listeners.current.delete(
            listener
          );
        };
      },
      []
    );

  return (
    <LiveContext.Provider
      value={{
        status,
        connectCount,
        subscribe,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useReloadOnConnect(
  load: () => void
) {
  const { connectCount } =
    useLive();

  const ref =
    useRef(load);

  ref.current = load;

  useEffect(() => {
    ref.current();
  }, [connectCount]);
}