type Obj = Record<string, unknown>;

// Decimal cua Prisma (decimal.js): ten lop co the bi rut gon khi dong goi, nen nhan ca theo cau truc d/e/s.
const isDecimal = (v: unknown): boolean => {
  if (
    typeof v !== 'object' ||
    v === null ||
    typeof (v as { toFixed?: unknown }).toFixed !== 'function'
  )
    return false;
  const o = v as { d?: unknown; e?: unknown; s?: unknown };
  return (
    v.constructor?.name === 'Decimal' ||
    (Array.isArray(o.d) && typeof o.e === 'number' && typeof o.s === 'number')
  );
};

const camel = (k: string): string => (k ? k[0].toLowerCase() + k.slice(1) : k);

export function serialize(v: unknown): unknown {
  if (v === undefined) return null;
  if (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  )
    return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (isDecimal(v)) return Number((v as { toString(): string }).toString());
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Obj).map(([k, x]) => [camel(k), serialize(x)]),
    );
  return v;
}

export function assertSerialized(v: unknown, path = '$'): void {
  if (typeof v === 'bigint') throw new Error(`${path}: bigint chua doi`);
  if (v instanceof Date) throw new Error(`${path}: Date chua doi`);
  if (isDecimal(v)) throw new Error(`${path}: Decimal chua doi`);
  if (Array.isArray(v))
    return v.forEach((x, i) => assertSerialized(x, `${path}[${i}]`));
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Obj)) {
      if (/^[A-Z]/.test(k)) throw new Error(`${path}.${k}: khoa PascalCase`);
      assertSerialized(x, `${path}.${k}`);
    }
  }
}

export function parseJsonColumn<T = unknown>(
  s: string | null | undefined,
  fallback: T,
): T {
  return s ? (JSON.parse(s) as T) : fallback;
}
