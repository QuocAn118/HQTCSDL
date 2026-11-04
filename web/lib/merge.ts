// Ghep du lieu REST voi su kien Socket.IO (spec web 2.4, hop dong 4.1). Ham thuan, khong sua dau vao.
import type { Alert, AlertStatus, AlertUpdated, Device, DeviceState, LatestReading, ReadingEvent } from './types';
import { toMs } from './time';

export type LatestMap = Record<string, LatestReading>;
export const latestKey = (deviceId: number, metric: string) => `${deviceId}:${metric}`;

type ReadingLike = Pick<LatestReading, 'deviceId' | 'metric' | 'value' | 'at'> & Partial<LatestReading>;

// So do moi nhat theo (deviceId, metric): so do co at cu hon hoac bang thi bo gia tri, chi lay truong con thieu
// (su kien den truoc REST khong co zoneName/unit/houseId).
export function mergeLatest(map: LatestMap, items: ReadingLike[]): LatestMap {
  const next: LatestMap = { ...map };
  for (const r of items) {
    const key = latestKey(r.deviceId, r.metric);
    const cur = next[key];
    next[key] = (cur && toMs(r.at) <= toMs(cur.at) ? { ...r, ...cur } : { ...(cur ?? {}), ...r }) as LatestReading;
  }
  return next;
}

export interface ChartPoint { key: string; t: number; value: number }

// Noi so do truc tiep vao bieu do: chi khi khoang dang xem chua thoi diem hien tai; khu trung theo (deviceId, metric, at).
export function appendLive(
  points: ChartPoint[], events: ReadingEvent[],
  view: { zoneId: number; metric: string; fromMs: number; toMs: number }, nowMs: number,
): ChartPoint[] {
  if (!(view.fromMs <= nowMs && nowMs < view.toMs)) return points;
  const seen = new Set(points.map((p) => p.key));
  const added: ChartPoint[] = [];
  for (const e of events) {
    if (e.zoneId !== view.zoneId || e.metric !== view.metric) continue;
    const t = toMs(e.at);
    const key = `${e.deviceId}:${e.metric}:${t}`;
    if (t < view.fromMs || t >= view.toMs || seen.has(key)) continue;
    seen.add(key);
    added.push({ key, t, value: e.value });
  }
  return added.length ? [...points, ...added].sort((a, b) => a.t - b.t) : points;
}

const RANK: Record<AlertStatus, number> = { NEW: 0, ACK: 1, RESOLVED: 2 };

// Canh bao gop theo alertId; trang thai chi tien NEW -> ACK -> RESOLVED. alert.updated cua canh bao chua co thi bo.
export function mergeAlert(list: Alert[], incoming: Alert | AlertUpdated): Alert[] {
  const i = list.findIndex((a) => a.alertId === incoming.alertId);
  if (i < 0) {
    if (!('alertType' in incoming)) return list;
    return [incoming, ...list].sort((a, b) => b.alertId - a.alertId);
  }
  if (RANK[incoming.status] < RANK[list[i].status]) return list;
  const next = list.slice();
  next[i] = { ...list[i], ...incoming } as Alert;
  return next;
}

export function mergeAlerts(list: Alert[], incoming: Array<Alert | AlertUpdated>): Alert[] {
  return incoming.reduce(mergeAlert, list);
}

// device.state ghi de TOAN BO (mode, isOn, level) -> ap lai nhieu lan van cung ket qua (idempotent).
export function applyDeviceState(devices: Device[], ev: Pick<DeviceState, 'deviceId' | 'mode' | 'isOn' | 'level'>): Device[] {
  return devices.map((d) => (d.deviceId === ev.deviceId ? { ...d, mode: ev.mode, isOn: ev.isOn, level: ev.level } : d));
}

// REST devices khong co moc thoi gian trang thai: ap REST roi ap lai cac su kien da giu theo thu tu den.
export function replayDeviceStates(restDevices: Device[], held: DeviceState[]): Device[] {
  return held.reduce(applyDeviceState, restDevices);
}

// Giu su kien trong luc REST tai (T4W-3). Tai lai khi mount va khi connect co the chong nhau:
// chi lan tai moi nhat duoc ap ket qua va tat giu; lan cu nhan null (bo ket qua REST cu).
export function createLoadGate<E>() {
  let seq = 0;
  let loading = false;
  let held: E[] = [];
  return {
    begin(): number {
      loading = true;
      held = [];
      return ++seq;
    },
    hold(ev: E): boolean {
      if (loading) held.push(ev);
      return loading;
    },
    end(id: number): E[] | null {
      if (id !== seq) return null;
      const out = held;
      held = [];
      loading = false;
      return out;
    },
  };
}

// readings.new: thiet bi vua gui so do coi la ONLINE (T7W-1). Chieu nguoc lai (im lang -> OFFLINE) chi khi tai lai REST.
// Khong doi gi -> tra lai dung mang cu de React khong ve lai.
export function markOnline(devices: Device[], readings: Pick<ReadingEvent, 'deviceId'>[]): Device[] {
  const ids = new Set(readings.map((r) => r.deviceId));
  if (!devices.some((d) => ids.has(d.deviceId) && d.status !== 'ONLINE')) return devices;
  return devices.map((d) => (ids.has(d.deviceId) && d.status !== 'ONLINE' ? { ...d, status: 'ONLINE' } : d));
}
