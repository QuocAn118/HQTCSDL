import { isUtcIso } from '../common/validation';
import { ReadingItem } from '../db/sp';

export type RejectReason =
  | 'KHONG_PHAI_JSON'
  | 'KHONG_PHAI_MANG'
  | 'THIEU_TRUONG'
  | 'SAI_KIEU'
  | 'THOI_GIAN'
  | 'SAI_THIET_BI';
export const BATCH_SIZE = 200;
export const NO_RETRY = [50030, 50042, 547];
export const UNKNOWN_RETRY_MS = [1000, 2000, 5000];

const example = (v: unknown) =>
  (typeof v === 'string' ? v : (JSON.stringify(v) ?? String(v))).slice(0, 200);

function reasonOf(code: string, e: unknown): RejectReason | null {
  if (e === null || typeof e !== 'object' || Array.isArray(e))
    return 'SAI_KIEU';
  const o = e as Record<string, unknown>;
  if (!['device', 'metric', 'value', 'at'].every((k) => k in o))
    return 'THIEU_TRUONG';
  if (
    typeof o.device !== 'string' ||
    typeof o.metric !== 'string' ||
    !o.metric ||
    typeof o.value !== 'number' ||
    !Number.isFinite(o.value) ||
    typeof o.at !== 'string'
  )
    return 'SAI_KIEU';
  if (!isUtcIso(o.at)) return 'THOI_GIAN';
  if (o.device !== code) return 'SAI_THIET_BI';
  return null;
}

// Kiem tung phan tu; phan tu sai bi bo, phan tu dung van vao hang cho (hop dong 2.3).
export function validateReadings(code: string, payload: Buffer) {
  const text = payload.toString('utf8');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      items: [],
      rejected: [
        { reason: 'KHONG_PHAI_JSON' as RejectReason, example: example(text) },
      ],
    };
  }
  if (!Array.isArray(data))
    return {
      items: [],
      rejected: [
        { reason: 'KHONG_PHAI_MANG' as RejectReason, example: example(data) },
      ],
    };
  const items: ReadingItem[] = [];
  const rejected: Array<{ reason: RejectReason; example: string }> = [];
  for (const e of data) {
    const reason = reasonOf(code, e);
    if (reason) {
      rejected.push({ reason, example: example(e) });
      continue;
    }
    const o = e as ReadingItem;
    items.push({
      device: o.device,
      metric: o.metric,
      value: o.value,
      at: o.at,
    });
  }
  return { items, rejected };
}
