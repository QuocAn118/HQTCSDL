import { ApiError } from '../common/errors';

const NUMBER_KEYS = ['number', 'originalCode', 'code', 'errorCode'];
const PRISMA_CODES: Record<string, number> = {
  P2002: 2627,
  P2003: 547,
  P2004: 547,
};
const MESSAGE_RULES: Array<[RegExp, number]> = [
  [/deadlock victim/i, 1205],
  [/conflicted with the (CHECK|FOREIGN KEY|REFERENCE) constraint/i, 547],
  [/duplicate key|UNIQUE KEY constraint|unique index/i, 2627],
  [/Login failed for user/i, 18456],
  [/Cannot open database/i, 4060],
];
const CONNECTION_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'ESOCKET',
  'ETIMEOUT',
  'ECONNCLOSED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTOPEN',
  'EINSTLOOKUP',
]);
const CONNECTION_MESSAGE =
  /Failed to connect|Connection lost|ConnectionError|socket hang up|Connection is closed|Timeout: Request failed|server closed the connection/i;

function* walk(
  err: unknown,
  seen = new Set<unknown>(),
): Generator<Record<string, unknown>> {
  if (err === null || typeof err !== 'object' || seen.has(err)) return;
  seen.add(err);
  const o = err as Record<string, unknown>;
  yield o;
  for (const k of [
    'cause',
    'meta',
    'driverAdapterError',
    'originalError',
    'error',
  ])
    yield* walk(o[k], seen);
}

export function sqlNumberOf(err: unknown): number | null {
  const messages: string[] = [];
  for (const o of walk(err)) {
    for (const k of NUMBER_KEYS) {
      const v = o[k];
      if (typeof v === 'string' && PRISMA_CODES[v]) return PRISMA_CODES[v];
      const n =
        typeof v === 'number'
          ? v
          : typeof v === 'string' && /^\d{3,5}$/.test(v)
            ? Number(v)
            : NaN;
      if (Number.isInteger(n) && n >= 100) return n;
    }
    if (typeof o.message === 'string') messages.push(o.message);
  }
  for (const m of messages)
    for (const [re, n] of MESSAGE_RULES) if (re.test(m)) return n;
  return null;
}

export function isConnectionError(err: unknown): boolean {
  for (const o of walk(err)) {
    if (typeof o.code === 'string' && CONNECTION_CODES.has(o.code)) return true;
    if (typeof o.message === 'string' && CONNECTION_MESSAGE.test(o.message))
      return true;
  }
  return false;
}

export const isDbConfigError = (n: number | null): boolean =>
  n === 18456 || n === 4060;

// Bang doi ma hop dong 3.5.
export function mapSqlError(n: number): ApiError {
  const fields: Record<number, string[]> = {
    50012: ['in', 'out'],
    50013: ['class'],
    50014: ['windowStart'],
  };
  if (fields[n])
    return new ApiError(400, 'VALIDATION_ERROR', n, { fields: fields[n] });
  const table: Record<number, [number, string]> = {
    50003: [409, 'DEVICE_NOT_CONTROLLABLE'],
    50010: [404, 'CAMERA_NOT_FOUND'],
    50020: [404, 'ALERT_NOT_FOUND'],
    50021: [409, 'ALERT_INVALID_TRANSITION'],
    50030: [400, 'INVALID_JSON'],
    50040: [400, 'INVALID_PARAMETER'],
    50041: [400, 'INVALID_PARAMETER'],
    50042: [400, 'INVALID_PARAMETER'],
    547: [400, 'CONSTRAINT_VIOLATION'],
    2627: [409, 'DUPLICATE'],
    2601: [409, 'DUPLICATE'],
    1205: [503, 'RETRY_LATER'],
  };
  const [status, code] = table[n] ?? [500, 'INTERNAL'];
  return new ApiError(status, code, n);
}
