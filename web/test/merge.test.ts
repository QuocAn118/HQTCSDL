import { describe, expect, it } from 'vitest';
import { appendLive, applyDeviceState, createLoadGate, latestKey, markOnline, mergeAlert, mergeAlerts, mergeLatest, replayDeviceStates } from '../lib/merge';
import type { Alert, Device, DeviceState, LatestReading } from '../lib/types';

const reading = (value: number, at: string): LatestReading => ({
  houseId: 1, zoneId: 2, zoneName: 'Tang 1', deviceId: 5, deviceCode: 'H1-F1-SENSOR', deviceStatus: 'ONLINE',
  metric: 'TEMP', unit: '°C', value, at,
});
const alert = (alertId: number, status: Alert['status']): Alert => ({
  alertId, houseId: 1, zoneId: 2, deviceId: null, alertType: 'THRESHOLD', severity: 'WARNING', metricCode: 'TEMP', value: 31,
  detectedClass: null, confidence: null, hasSnapshot: false, message: 'm', status, createdAt: '2026-10-12T10:40:00Z',
});
const device: Device = {
  deviceId: 9, zoneId: 2, code: 'H1-F1-FAN', name: 'Quat', deviceType: 'FAN', status: 'ONLINE', lastSeenAt: null,
  mode: 'AUTO', isOn: false, level: 0, isActive: true,
};
const state = (o: Partial<DeviceState>): DeviceState => ({
  deviceId: 9, deviceCode: 'H1-F1-FAN', houseId: 1, zoneId: 2, mode: 'AUTO', isOn: true, level: 100, source: 'AUTO',
  at: '2026-10-12T10:40:00Z', ...o,
});

describe('mergeLatest', () => {
  it('bo so do cu hon hoac bang (ke ca khac dang chuoi), nhan so do moi hon', () => {
    let m = mergeLatest({}, [reading(28, '2026-10-12T10:40:10.000Z')]);
    m = mergeLatest(m, [reading(29, '2026-10-12T10:40:10Z'), reading(27, '2026-10-12T10:40:00Z')]);
    expect(m[latestKey(5, 'TEMP')].value).toBe(28);
    m = mergeLatest(m, [{ deviceId: 5, metric: 'TEMP', value: 30, at: '2026-10-12T10:40:20Z' }]);
    expect(m[latestKey(5, 'TEMP')]).toMatchObject({ value: 30, zoneName: 'Tang 1' });
  });
});

describe('appendLive', () => {
  const view = { zoneId: 2, metric: 'TEMP', fromMs: Date.parse('2026-10-12T10:00:00Z'), toMs: Date.parse('2026-10-12T11:00:00Z') };
  const ev = (at: string, zoneId = 2) => ({ deviceId: 5, deviceCode: 'H1-F1-SENSOR', zoneId, metric: 'TEMP' as const, value: 28, at });
  const now = Date.parse('2026-10-12T10:41:00Z');

  it('khu trung theo (deviceId, metric, at)', () => {
    const p = appendLive([], [ev('2026-10-12T10:40:00Z'), ev('2026-10-12T10:40:00.000Z')], view, now);
    expect(p).toHaveLength(1);
    expect(appendLive(p, [ev('2026-10-12T10:40:00Z')], view, now)).toBe(p);
  });

  it('khoang dang xem khong chua hien tai -> khong noi; khu vuc khac -> bo', () => {
    expect(appendLive([], [ev('2026-10-12T10:40:00Z')], view, Date.parse('2026-10-12T12:00:00Z'))).toEqual([]);
    expect(appendLive([], [ev('2026-10-12T10:40:00Z', 3)], view, now)).toEqual([]);
  });
});

describe('mergeAlert', () => {
  it('RESOLVED khong bi NEW/ACK ghi de', () => {
    const list = [alert(1, 'RESOLVED')];
    expect(mergeAlert(list, alert(1, 'NEW'))[0].status).toBe('RESOLVED');
    expect(mergeAlert(list, { alertId: 1, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null })[0].status).toBe('RESOLVED');
  });

  it('alert.created trung alertId khong nhan doi; moi thi them, sap theo alertId giam', () => {
    let list = mergeAlerts([alert(1, 'NEW')], [alert(1, 'NEW'), alert(3, 'NEW')]);
    expect(list.map((a) => a.alertId)).toEqual([3, 1]);
    list = mergeAlert(list, { alertId: 1, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null });
    expect(list.find((a) => a.alertId === 1)?.status).toBe('ACK');
  });

  it('alert.updated cua canh bao chua co -> bo qua', () => {
    expect(mergeAlert([], { alertId: 7, houseId: 1, status: 'ACK', resolvedAt: null, resolvedBy: null })).toEqual([]);
  });
});

describe('trang thai thiet bi', () => {
  it('REST roi ap lai su kien da giu -> trang thai cua su kien cuoi', () => {
    const r = replayDeviceStates([device], [state({ isOn: true, level: 100 }), state({ mode: 'MANUAL', isOn: true, level: 50 })]);
    expect(r[0]).toMatchObject({ mode: 'MANUAL', isOn: true, level: 50 });
  });

  it('idempotent: ap mot su kien hai lan, hoac trung voi REST, khong doi ket qua', () => {
    const once = applyDeviceState([device], state({}));
    expect(applyDeviceState(once, state({}))).toEqual(once);
    expect(applyDeviceState([device], state({ isOn: false, level: 0 }))).toEqual([device]);
  });
});

// Ca bien them ngoai plan (spec web 2.4).
describe('ca bien', () => {
  const updated = (status: Alert['status']) => ({ alertId: 1, houseId: 1, status, resolvedAt: null, resolvedBy: null });

  it('mergeLatest: su kien den truoc REST cung at (khac dang chuoi) -> giu gia tri su kien, bo sung zoneName/unit tu REST', () => {
    let m = mergeLatest({}, [{ deviceId: 5, zoneId: 2, deviceCode: 'H1-F1-SENSOR', metric: 'TEMP', value: 29, at: '2026-10-12T10:40:10Z' }]);
    m = mergeLatest(m, [reading(28, '2026-10-12T10:40:10.000Z')]);
    expect(m[latestKey(5, 'TEMP')]).toMatchObject({ value: 29, at: '2026-10-12T10:40:10Z', zoneName: 'Tang 1', unit: '°C', houseId: 1 });
  });

  it('mergeLatest: REST cu hon den sau su kien -> khong lui gia tri', () => {
    let m = mergeLatest({}, [{ deviceId: 5, zoneId: 2, deviceCode: 'H1-F1-SENSOR', metric: 'TEMP', value: 30, at: '2026-10-12T10:40:20Z' }]);
    m = mergeLatest(m, [reading(28, '2026-10-12T10:40:10.000Z')]);
    expect(m[latestKey(5, 'TEMP')]).toMatchObject({ value: 30, at: '2026-10-12T10:40:20Z', zoneName: 'Tang 1' });
  });

  it('mergeLatest: khong sua map dau vao; khoa khac metric la rieng', () => {
    const m0 = mergeLatest({}, [reading(28, '2026-10-12T10:40:10Z')]);
    const snapshot = structuredClone(m0);
    const m1 = mergeLatest(m0, [reading(30, '2026-10-12T10:40:20Z'), { ...reading(70, '2026-10-12T10:40:00Z'), metric: 'HUMID' }]);
    expect(m0).toEqual(snapshot);
    expect(m1[latestKey(5, 'HUMID')].value).toBe(70);
    expect(m1[latestKey(5, 'TEMP')].value).toBe(30);
  });

  it('appendLive: bien khoang [from, to), sap theo t, bo metric khac', () => {
    const view = { zoneId: 2, metric: 'TEMP', fromMs: Date.parse('2026-10-12T10:00:00Z'), toMs: Date.parse('2026-10-12T11:00:00Z') };
    const ev = (at: string, metric: 'TEMP' | 'HUMID' = 'TEMP') => ({ deviceId: 5, deviceCode: 'S', zoneId: 2, metric, value: 1, at });
    const p = appendLive([], [
      ev('2026-10-12T10:30:00Z'), ev('2026-10-12T10:00:00.000Z'), ev('2026-10-12T11:00:00Z'), ev('2026-10-12T10:20:00Z', 'HUMID'),
    ], view, Date.parse('2026-10-12T10:41:00Z'));
    expect(p.map((x) => x.t)).toEqual([Date.parse('2026-10-12T10:00:00Z'), Date.parse('2026-10-12T10:30:00Z')]);
    expect(appendLive([], [ev('2026-10-12T10:30:00Z')], view, view.toMs)).toEqual([]);
  });

  it('mergeAlert: ACK khong lui ve NEW; NEW nhay thang RESOLVED duoc; cung trang thai ap lai khong doi', () => {
    expect(mergeAlert([alert(1, 'ACK')], updated('NEW'))[0].status).toBe('ACK');
    expect(mergeAlert([alert(1, 'ACK')], alert(1, 'NEW'))[0].status).toBe('ACK');
    expect(mergeAlert([alert(1, 'NEW')], updated('RESOLVED'))[0].status).toBe('RESOLVED');
    const once = mergeAlert([alert(1, 'NEW')], updated('ACK'));
    expect(mergeAlert(once, updated('ACK'))).toEqual(once);
  });

  it('device.state: ghi de ca level null; thiet bi khong co thi bo; khong giu su kien -> giu REST', () => {
    const fan = { ...device, mode: 'MANUAL' as const, isOn: true, level: 50 };
    expect(applyDeviceState([fan], state({ mode: 'AUTO', isOn: false, level: null }))[0]).toMatchObject({ mode: 'AUTO', isOn: false, level: null });
    expect(applyDeviceState([device], state({ deviceId: 99 }))).toEqual([device]);
    expect(replayDeviceStates([device], [])).toEqual([device]);
  });

  it('device.state: ap lai chuoi su kien hai lan -> cung ket qua (ap lai khi tai lai REST)', () => {
    const held = [state({ mode: 'MANUAL', isOn: true, level: 80 }), state({ mode: 'AUTO', isOn: false, level: 0 })];
    const r1 = replayDeviceStates([device], held);
    expect(replayDeviceStates(r1, held)).toEqual(r1);
    expect(r1[0]).toMatchObject({ mode: 'AUTO', isOn: false, level: 0 });
  });
});

// T4W-3: giu device.state trong luc REST tai; hai lan tai chong nhau (mount + connect) chi lan moi nhat ap.
describe('createLoadGate', () => {
  it('ngoai luc tai -> khong giu; trong luc tai -> giu theo thu tu den, ket thuc tra danh sach roi xoa', () => {
    const g = createLoadGate<number>();
    expect(g.hold(1)).toBe(false);
    const id = g.begin();
    expect(g.hold(2)).toBe(true);
    expect(g.hold(3)).toBe(true);
    expect(g.end(id)).toEqual([2, 3]);
    expect(g.hold(4)).toBe(false);
  });

  it('hai lan tai chong nhau: lan cu ket thuc truoc khong tat giu, tra null; lan moi nhat nhan du su kien', () => {
    const g = createLoadGate<string>();
    const a = g.begin();
    const b = g.begin();
    g.hold('x');
    expect(g.end(a)).toBeNull();
    expect(g.hold('y')).toBe(true);
    expect(g.end(b)).toEqual(['x', 'y']);
    expect(g.hold('z')).toBe(false);
  });

  it('lan cu ket thuc sau lan moi -> null, khong mo lai giu', () => {
    const g = createLoadGate<string>();
    const a = g.begin();
    const b = g.begin();
    expect(g.end(b)).toEqual([]);
    expect(g.end(a)).toBeNull();
    expect(g.hold('z')).toBe(false);
  });
});

// T7W-1: readings.new -> thiet bi gui duoc coi la ONLINE (chieu nguoc lai chi khi tai lai REST).
describe('markOnline', () => {
  const sensor = { ...device, deviceId: 5, code: 'H1-F1-SENSOR', deviceType: 'SENSOR' as const, status: 'OFFLINE' };
  const ev = (deviceId: number) => ({ deviceId, deviceCode: 'X', zoneId: 2, metric: 'TEMP' as const, value: 28, at: '2026-10-12T10:40:00Z' });

  it('thiet bi co trong readings -> ONLINE; thiet bi khac giu nguyen', () => {
    const fanOff = { ...device, status: 'OFFLINE' };
    const r = markOnline([sensor, fanOff], [ev(5), ev(5)]);
    expect(r[0].status).toBe('ONLINE');
    expect(r[1]).toBe(fanOff);
  });

  it('khong co gi doi (da ONLINE hoac khong lien quan) -> tra lai dung mang cu', () => {
    const online = [{ ...sensor, status: 'ONLINE' }];
    expect(markOnline(online, [ev(5)])).toBe(online);
    expect(markOnline([sensor], [ev(99)])[0]).toBe(sensor);
    expect(markOnline([sensor], [])[0].status).toBe('OFFLINE');
  });
});
