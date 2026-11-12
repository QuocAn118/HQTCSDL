import { describe, expect, it } from 'vitest';
import { groupByZone, modeText, onBody, stateText } from '../components/devices';
import type { Device, Zone } from '../lib/types';

const dev = (p: Partial<Device>): Device => ({
  deviceId: 1, zoneId: 1, code: 'X', name: 'X', deviceType: 'FAN', status: 'ONLINE',
  lastSeenAt: null, mode: 'AUTO', isOn: false, level: null, isActive: true, ...p,
});

describe('stateText (giu nguyen chu demo dung)', () => {
  it('quat bat 50% tay', () => {
    expect(stateText(dev({ isOn: true, level: 50, mode: 'MANUAL' }))).toBe('Đang bật 50% · Điều khiển tay');
  });
  it('tat tu dong, khong kem %', () => {
    expect(stateText(dev({ isOn: false, level: 0, mode: 'AUTO' }))).toBe('Đang tắt · Tự động');
  });
  it('thiet bi khong phai quat thi khong co %', () => {
    expect(stateText(dev({ deviceType: 'SPEAKER', isOn: true, level: null }))).toBe('Đang bật · Tự động');
  });
});

describe('onBody (nut Bat)', () => {
  it('quat muc 0 -> gui tat', () => expect(onBody(true, 0)).toEqual({ mode: 'MANUAL', isOn: false }));
  it('quat muc 50 -> bat kem level', () => expect(onBody(true, 50)).toEqual({ mode: 'MANUAL', isOn: true, level: 50 }));
  it('khong phai quat -> bat, khong level', () => expect(onBody(false, 50)).toEqual({ mode: 'MANUAL', isOn: true }));
});

describe('modeText', () => {
  it('AUTO/MANUAL ra chu Viet, ma la giu nguyen', () => {
    expect(modeText('AUTO')).toBe('Tự động');
    expect(modeText('MANUAL')).toBe('Điều khiển tay');
    expect(modeText('KHAC')).toBe('KHAC');
  });
});

describe('groupByZone', () => {
  const zones: Zone[] = [
    { zoneId: 2, houseId: 1, name: 'Tầng 2', floorNo: 2 },
    { zoneId: 1, houseId: 1, name: 'Tầng 1', floorNo: 1 },
    { zoneId: 3, houseId: 1, name: 'Tầng 3', floorNo: 3 },
  ];
  it('theo thu tu khu vuc, bo khu vuc rong, thiet bi khong ro khu vuc xep cuoi voi zone null', () => {
    const a = dev({ deviceId: 1, zoneId: 1 });
    const b = dev({ deviceId: 2, zoneId: 2 });
    const c = dev({ deviceId: 3, zoneId: 9 });
    const g = groupByZone(zones, [a, b, c]);
    expect(g.map((x) => x.zone?.name ?? null)).toEqual(['Tầng 2', 'Tầng 1', null]);
    expect(g[2].devices).toEqual([c]);
  });
});
