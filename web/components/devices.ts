// Ham thuan cho trang Thiet bi (web-ui T3): chu trang thai, than lenh nut Bat, chu che do, nhom theo khu vuc.
import type { Device, Zone } from '../lib/types';

const MODE_LABEL: Record<string, string> = { AUTO: 'Tự động', MANUAL: 'Điều khiển tay' };

export function modeText(mode: string | null): string {
  return mode === null ? '—' : (MODE_LABEL[mode] ?? mode);
}

// Demo tim dung chuoi "Đang bật 50% · Điều khiển tay" va "· Tự động".
export function stateText(d: Device): string {
  const pct = d.deviceType === 'FAN' && d.isOn ? ` ${d.level ?? 0}%` : '';
  return `${d.isOn ? 'Đang bật' : 'Đang tắt'}${pct} · ${d.mode === 'MANUAL' ? 'Điều khiển tay' : 'Tự động'}`;
}

// FAN muc 0 = tat (giong mobile, spec web); khong co trang thai "bat, muc 0".
export function onBody(isFan: boolean, level: number): Record<string, unknown> {
  if (isFan && level === 0) return { mode: 'MANUAL', isOn: false };
  return { mode: 'MANUAL', isOn: true, ...(isFan ? { level } : {}) };
}

export function groupByZone(zones: Zone[], devices: Device[]): { zone: Zone | null; devices: Device[] }[] {
  const groups: { zone: Zone | null; devices: Device[] }[] = zones
    .map((zone) => ({ zone, devices: devices.filter((d) => d.zoneId === zone.zoneId) }))
    .filter((g) => g.devices.length > 0);
  const known = new Set(zones.map((z) => z.zoneId));
  const rest = devices.filter((d) => !known.has(d.zoneId));
  if (rest.length) groups.push({ zone: null, devices: rest });
  return groups;
}
