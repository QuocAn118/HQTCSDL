// Ham thuan cho trang Tong quan: xet vuot nguong, dem tom tat, ten thiet bi khong lap, moc gio moi nhat cua khu vuc.
import { ACTUATORS, showOffline } from '../lib/config';
import { toMs } from '../lib/time';
import type { Device, Threshold } from '../lib/types';

export type Breach = { kind: 'max' | 'min'; limit: number };

// Ngoai nguong khi lon hon Max hoac nho hon Min (bang nguong van la binh thuong, giong backend).
export function thresholdBreach(value: number | null, t: Threshold | undefined): Breach | null {
  if (value === null || !t) return null;
  if (t.maxValue !== null && value > t.maxValue) return { kind: 'max', limit: t.maxValue };
  if (t.minValue !== null && value < t.minValue) return { kind: 'min', limit: t.minValue };
  return null;
}

export function summarize(devices: Device[] | null): { on: number; total: number; offlineSensors: number } | null {
  if (!devices) return null;
  const active = devices.filter((d) => d.isActive);
  const actuators = active.filter((d) => ACTUATORS.includes(d.deviceType));
  return {
    on: actuators.filter((d) => d.isOn).length,
    total: actuators.length,
    offlineSensors: active.filter((d) => d.deviceType === 'SENSOR' && showOffline(d.deviceType, d.status)).length,
  };
}

// "Phun sương — Phun sương H1 tầng 0" -> "Phun sương H1 tầng 0"; ten khong noi ro loai thi giu tien to loai.
export function deviceTitle(typeLabel: string, name: string): string {
  return name.toLowerCase().startsWith(typeLabel.toLowerCase()) ? name : `${typeLabel} — ${name}`;
}

export function latestAt(times: string[]): string | null {
  return times.reduce<string | null>((best, t) => (best === null || toMs(t) > toMs(best) ? t : best), null);
}
