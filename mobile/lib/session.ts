import * as SecureStore from 'expo-secure-store';
import type { LoginResponse, User } from './types';

export interface Session {
  accessToken: string;
  user: User;
  expiresAt: number;
}

const KEY = 'swiftletcare.session';

export function sessionFromLogin(
  res: LoginResponse,
  nowMs: number = Date.now()
): Session {
  return {
    accessToken: res.accessToken,
    user: res.user,
    expiresAt: nowMs + res.expiresIn * 1000,
  };
}

export async function saveSession(s: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}

export async function loadSession(
  nowMs: number = Date.now()
): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);

    if (!raw) return null;

    const s = JSON.parse(raw) as Session;

    if (!s.accessToken || !(s.expiresAt > nowMs)) {
      await clearSession();
      return null;
    }

    return s;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // bo qua
  }
}