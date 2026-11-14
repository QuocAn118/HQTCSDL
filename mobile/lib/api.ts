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

export function snapshotSource(alertId: number) {
  return {
    uri: `${API_URL}/api/alerts/${alertId}/snapshot`,
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  };
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