'use client';
// Cong xac thuc cho cac trang can dang nhap (spec web 2.1): doc phien trong useEffect, hen gio het han, 401 -> dang xuat.
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setOnUnauthorized } from './api';
import { clearSession, loadSession, type Session } from './session';

export type LogoutReason = 'expired' | 'unauthorized' | undefined;
interface AuthValue { session: Session; logout: (reason?: LogoutReason) => void }
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth phai nam trong AuthGate');
  return v;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  const logout = useCallback((reason?: LogoutReason) => {
    clearSession();
    setSession(null);
    router.replace(reason ? `/login?reason=${reason}` : '/login');
  }, [router]);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSession(s);
    setOnUnauthorized(() => logout('unauthorized'));
    const timer = setTimeout(() => logout('expired'), s.expiresAt - Date.now());
    return () => {
      clearTimeout(timer);
      setOnUnauthorized(() => {});
    };
  }, [router, logout]);

  if (!session) return <p className="p-8 text-stone-500">Đang tải…</p>;
  return <AuthContext.Provider value={{ session, logout }}>{children}</AuthContext.Provider>;
}
