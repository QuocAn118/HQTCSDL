// fetch toi backend kem token; doc dinh dang loi hop dong 3.4; 401 -> dang xuat (spec web 2.1, 2.2).
import { ApiError, toApiError } from './errors';
import { loadSession } from './session';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(fn: () => void): void {
  onUnauthorized = fn;
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const token = loadSession()?.accessToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', null);
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await send(path, method, body);
  const data = await res.json().catch(() => null);
  if (res.ok) return data as T;
  if (res.status === 401 && path !== '/api/auth/login') onUnauthorized();
  throw toApiError(res.status, data);
}

// Anh thien dich: fetch kem Authorization -> blob (the <img> khong gui duoc header). 404 -> null.
export async function fetchBlob(path: string): Promise<Blob | null> {
  const res = await send(path, 'GET');
  if (res.status === 404) return null;
  if (res.status === 401) onUnauthorized();
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
  return res.blob();
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
};
