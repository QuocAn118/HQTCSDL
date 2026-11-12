import { describe, expect, it } from 'vitest';
import { deviceTitle, latestAt, summarize, thresholdBreach } from '../components/overview';
import type { Device, Threshold } from '../lib/types';

const dev = (deviceId: number, deviceType: Device['deviceType'], extra: Partial<Device> = {}): Device => ({
  deviceId, zoneId: 1, code: `D${deviceId}`, name: `Thiết bị ${deviceId}`, deviceType, status: 'ONLINE', lastSeenAt: null,
  mode: 'AUTO', isOn: false, level: null, isActive: true, ...extra,
});
const th = (minValue: number | null, maxValue: number | null): Threshold => ({ zoneId: 1, metricCode: 'TEMP', minValue, maxValue, targetValue: null, updatedBy: null, updatedAt: null });

describe('thresholdBreach (web-ui T2)', () => {
  it('vuot Max -> kind max kem nguong that; duoi Min -> kind min', () => {
    expect(thresholdBreach(31.5, th(26, 30))).toEqual({ kind: 'max', limit: 30 });
    expect(thresholdBreach(74.9, th(75, 90))).toEqual({ kind: 'min', limit: 75 });
  });
  it('bang nguong, trong khoang, thieu so do hoac thieu nguong -> null', () => {
    expect(thresholdBreach(30, th(26, 30))).toBeNull();
    expect(thresholdBreach(28, th(26, 30))).toBeNull();
    expect(thresholdBreach(null, th(26, 30))).toBeNull();
    expect(thresholdBreach(99, undefined)).toBeNull();
    expect(thresholdBreach(99, th(null, null))).toBeNull();
  });
});

describe('summarize (web-ui T2)', () => {
  it('dem co cau chap hanh dang dung dang bat / tong, cam bien OFFLINE dang dung', () => {
    const list = [
      dev(1, 'FAN', { isOn: true }), dev(2, 'MIST'), dev(3, 'SPEAKER', { isOn: true }), dev(4, 'HEATER', { isOn: true, isActive: false }),
      dev(5, 'SENSOR', { status: 'OFFLINE' }), dev(6, 'SENSOR'), dev(7, 'SENSOR', { status: 'OFFLINE', isActive: false }), dev(8, 'CAMERA', { status: 'OFFLINE' }),
    ];
    expect(summarize(list)).toEqual({ on: 2, total: 3, offlineSensors: 1 });
  });
  it('chua tai thiet bi -> null', () => {
    expect(summarize(null)).toBeNull();
  });
});

describe('deviceTitle (web-ui T2)', () => {
  it('ten da bat dau bang loai -> chi hien ten (khong lap "Phun sương — Phun sương ...")', () => {
    expect(deviceTitle('Phun sương', 'Phun sương H1 tầng 0')).toBe('Phun sương H1 tầng 0');
    expect(deviceTitle('Quạt', 'quạt hút')).toBe('quạt hút');
  });
  it('ten khong chua loai -> them loai phia truoc', () => {
    expect(deviceTitle('Loa', 'Loa dẫn dụ H1')).toBe('Loa dẫn dụ H1');
    expect(deviceTitle('Sưởi', 'Đèn sưởi góc')).toBe('Sưởi — Đèn sưởi góc');
  });
});

describe('latestAt (web-ui T2)', () => {
  it('moc gio moi nhat trong cac so do cua khu vuc; khong co -> null', () => {
    expect(latestAt(['2026-11-12T10:00:00Z', '2026-11-12T10:00:09Z', '2026-11-12T09:59:59Z'])).toBe('2026-11-12T10:00:09Z');
    expect(latestAt([])).toBeNull();
  });
});
