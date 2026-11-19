import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import {
  setApiToken,
  setOnUnauthorized,
} from './api';

import {
  clearSession,
  loadSession,
  saveSession,
  sessionFromLogin,
  type Session,
} from './session';

import type { LoginResponse } from './types';

interface AuthValue {
  ready: boolean;
  session: Session | null;
  notice: string | null;

  login: (res: LoginResponse) => Promise<void>;

  logout: (notice?: string) => void;
}

const AuthContext =
  createContext<AuthValue | null>(null);

export const EXPIRED =
  'Phiên đã hết hạn, vui lòng đăng nhập lại.';

export const INVALID =
  'Phiên không còn hợp lệ, vui lòng đăng nhập lại.';

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error(
      'useAuth phai nam trong AuthProvider'
    );
  }

  return value;
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  const [session, setSession] =
    useState<Session | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const logout = useCallback(
    (text?: string) => {
      void clearSession();

      setApiToken(null);

      setSession(null);

      setNotice(text ?? null);
    },
    []
  );

  useEffect(() => {
    setOnUnauthorized(() =>
      logout(INVALID)
    );

    loadSession().then((s) => {
      setApiToken(
        s?.accessToken ?? null
      );

      setSession(s);

      setReady(true);
    });
  }, [logout]);

  useEffect(() => {
    if (!session) return;

    const check = () => {
      if (
        Date.now() >=
        session.expiresAt
      ) {
        logout(EXPIRED);
      }
    };

    const timer = setTimeout(
      check,
      Math.max(
        0,
        session.expiresAt -
          Date.now()
      )
    );

    const sub =
      AppState.addEventListener(
        'change',
        (state) => {
          if (state === 'active') {
            check();
          }
        }
      );

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [session, logout]);

  const login = useCallback(
    async (res: LoginResponse) => {
      const s =
        sessionFromLogin(res);

      await saveSession(s);

      setApiToken(
        s.accessToken
      );

      setNotice(null);

      setSession(s);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        ready,
        session,
        notice,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}