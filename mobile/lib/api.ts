import { ApiError, toApiError } from './errors';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/$/, '');

let token: string | null = null;
let onUnauthorized: () => void = () => {};

export const setApiToken = (t: string | null) => {
  token = t;
};

export const getApiToken = () => token;

export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;

  try {
    res = await fetch(API_URL + path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  } catch {
    throw new ApiError(0, 'NETWORK', null);
  }

  const data = await res.json().catch(() => null);

  if (res.ok) {
    return data as T;
  }

  if (
    res.status === 401 &&
    path !== '/api/auth/login'
  ) {
    onUnauthorized();
  }

  throw toApiError(res.status, data);
}

// Android <Image> bo qua source.headers (backend tra 401), nen tai anh bang fetch roi dua data URI cho <Image>.
export async function fetchSnapshot(alertId: number): Promise<string> {
  const res = await fetch(`${API_URL}/api/alerts/${alertId}/snapshot`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/jpeg;base64,${btoa(bin)}`;
}

export const qs = (
  params: Record<
    string,
    string | number | undefined | null
  >
) => {
  const p = Object.entries(params).filter(
    ([, v]) =>
      v !== undefined &&
      v !== null &&
      v !== ''
  );

  return p.length
    ? '?' +
        p
          .map(
            ([k, v]) =>
              `${k}=${encodeURIComponent(
                String(v)
              )}`
          )
          .join('&')
    : '';
};