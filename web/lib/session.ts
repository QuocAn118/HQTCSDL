// Phien dang nhap trong sessionStorage (spec web 2.1). CHI goi trong useEffect hoac trong xu ly su kien.
import type { LoginResponse, User } from './types';

export interface Session { accessToken: string; user: User; expiresAt: number }
const KEY = 'swiftletcare.session';

export function sessionFromLogin(res: LoginResponse, nowMs: number = Date.now()): Session {
  return { accessToken: res.accessToken, user: res.user, expiresAt: nowMs + res.expiresIn * 1000 };
}

export function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // trinh duyet chan storage: phien chi song trong trang hien tai
  }
}

export function loadSession(nowMs: number = Date.now()): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.accessToken || !(s.expiresAt > nowMs)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // bo qua
  }
}
