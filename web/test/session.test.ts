import { afterEach, describe, expect, it, vi } from 'vitest';
import { qs } from '../lib/api';
import { clearSession, loadSession, saveSession, sessionFromLogin, type Session } from '../lib/session';
import type { LoginResponse } from '../lib/types';

const KEY = 'swiftletcare.session';
const user = { userId: 2, username: 'owner1', fullName: 'Chu nha 1', email: null, phone: null, role: 'OWNER' as const, isActive: true };
const NOW = Date.parse('2026-10-12T10:00:00Z');

// sessionStorage gia trong moi truong node cua vitest.
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => m.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void m.set(k, v)),
    removeItem: vi.fn((k: string) => void m.delete(k)),
    map: m,
  };
}
const throwing = () => {
  const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
  return { getItem: vi.fn(boom), setItem: vi.fn(boom), removeItem: vi.fn(boom) };
};

afterEach(() => vi.unstubAllGlobals());

describe('session (spec web 2.1)', () => {
  it('sessionFromLogin: expiresAt = now + expiresIn giay', () => {
    const res: LoginResponse = { accessToken: 'tok', expiresIn: 28800, user };
    expect(sessionFromLogin(res, NOW)).toEqual({ accessToken: 'tok', user, expiresAt: NOW + 28_800_000 });
  });

  it('luu roi doc lai khi con han', () => {
    const st = memoryStorage();
    vi.stubGlobal('sessionStorage', st);
    const s: Session = { accessToken: 'tok', user, expiresAt: NOW + 1000 };
    saveSession(s);
    expect(loadSession(NOW)).toEqual(s);
  });

  it('het han (expiresAt <= now) -> xoa khoa, tra null', () => {
    const st = memoryStorage();
    vi.stubGlobal('sessionStorage', st);
    saveSession({ accessToken: 'tok', user, expiresAt: NOW });
    expect(loadSession(NOW)).toBeNull();
    expect(st.removeItem).toHaveBeenCalledWith(KEY);
    expect(st.map.has(KEY)).toBe(false);
  });

  it('thieu token hoac thieu expiresAt -> xoa, tra null; JSON hong -> null, khong nem', () => {
    const st = memoryStorage();
    vi.stubGlobal('sessionStorage', st);
    st.map.set(KEY, JSON.stringify({ accessToken: '', user, expiresAt: NOW + 1000 }));
    expect(loadSession(NOW)).toBeNull();
    expect(st.map.has(KEY)).toBe(false);
    st.map.set(KEY, JSON.stringify({ accessToken: 'tok', user }));
    expect(loadSession(NOW)).toBeNull();
    expect(st.map.has(KEY)).toBe(false);
    st.map.set(KEY, '{hong');
    expect(loadSession(NOW)).toBeNull();
  });

  it('chua co phien -> null; clearSession xoa khoa', () => {
    const st = memoryStorage();
    vi.stubGlobal('sessionStorage', st);
    expect(loadSession(NOW)).toBeNull();
    saveSession({ accessToken: 'tok', user, expiresAt: NOW + 1000 });
    clearSession();
    expect(st.map.has(KEY)).toBe(false);
  });

  it('storage nem loi (trinh duyet chan) -> save/load/clear khong vo, load tra null', () => {
    vi.stubGlobal('sessionStorage', throwing());
    expect(() => saveSession({ accessToken: 'tok', user, expiresAt: NOW + 1000 })).not.toThrow();
    expect(loadSession(NOW)).toBeNull();
    expect(() => clearSession()).not.toThrow();
  });

  it('khong co sessionStorage (moi truong khong phai trinh duyet) -> khong vo', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(() => saveSession({ accessToken: 'tok', user, expiresAt: NOW + 1000 })).not.toThrow();
    expect(loadSession(NOW)).toBeNull();
    expect(() => clearSession()).not.toThrow();
  });
});

describe('qs', () => {
  it('bo undefined, null, chuoi rong; giu 0; ma hoa gia tri', () => {
    expect(qs({ status: 'NEW', zoneId: 0, before: undefined, type: null, q: '' })).toBe('?status=NEW&zoneId=0');
    expect(qs({ from: '2026-10-12T10:00:00Z', note: 'a&b c' })).toBe('?from=2026-10-12T10%3A00%3A00Z&note=a%26b%20c');
  });

  it('khong con tham so -> chuoi rong', () => {
    expect(qs({})).toBe('');
    expect(qs({ a: undefined, b: null, c: '' })).toBe('');
  });
});
