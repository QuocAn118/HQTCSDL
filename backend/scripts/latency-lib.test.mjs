import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertStatus, alertValues, createTracker, isProbeAlert, percentile, summarize, toCsv } from './latency-lib.mjs';

test('percentile theo hang gan nhat', () => {
  const v = [5, 1, 4, 2, 3];
  assert.equal(percentile(v, 50), 3);
  assert.equal(percentile(v, 95), 5);
  assert.equal(percentile([7], 95), 7);
  const h = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(h, 99), 99);
  assert.equal(percentile(h, 100), 100);
});

test('summarize: so mau, p50, p95, p99, max, ty le vuot chi tieu, so mat; mang rong khong loi', () => {
  assert.deepEqual(summarize([100, 200, 3000, 400], 2000, 1), { n: 4, p50: 200, p95: 3000, p99: 3000, max: 3000, overTarget: 0.25, lost: 1 });
  assert.deepEqual(summarize([], 2000), { n: 0, p50: 0, p95: 0, p99: 0, max: 0, overTarget: 0, lost: 0 });
});

test('toCsv: dong tieu de, cot at, mau mat de trong ms', () => {
  assert.equal(toCsv([{ kind: 'alert', zone: 'H1-F1', at: '2026-11-08T03:00:01Z', ms: '', status: 'mat' }]), 'kind,zone,at,ms,status\nalert,H1-F1,2026-11-08T03:00:01Z,,mat\n');
});

const AT = '2026-11-08T03:00:01Z';
const ev = (over = {}) => ({ deviceCode: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.01, at: AT, ...over });

test('tracker: ghep su kien theo thiet bi + chi so + giay at, do tu luc gui', () => {
  const t = createTracker(5000);
  assert.equal(t.sent({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.01, at: AT }, 1000), true);
  assert.equal(t.received(ev({ deviceCode: 'H1-F2-SENSOR' }), 1100), false); // thiet bi khac: bo qua
  assert.equal(t.received(ev({ at: '2026-11-08T03:00:01.000Z' }), 1450), true); // cung giay, viet khac van khop
  assert.equal(t.received(ev(), 1500), false); // giao lap: khong tinh lai
  assert.deepEqual(t.rows, [{ kind: 'probe', zone: 'H1-F1-SENSOR', at: AT, ms: 450, status: 'ok' }]);
  assert.equal(t.pending(), 0);
});

test('tracker: qua han ghi mat; den muon sau han khong tinh lai thanh ok', () => {
  const t = createTracker(5000);
  t.sent({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.01, at: AT }, 1000);
  t.expire(5999);
  assert.equal(t.pending(), 1);
  t.expire(6001);
  t.received(ev(), 7000);
  assert.deepEqual(t.rows, [{ kind: 'probe', zone: 'H1-F1-SENSOR', at: AT, ms: '', status: 'mat' }]);
});

test('tracker: trung giay voi simulator (gia tri khac) ghi trung, khong tinh do tre', () => {
  const t = createTracker(5000);
  t.sent({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.01, at: AT }, 1000);
  t.received(ev({ value: 27.9 }), 1300);
  assert.deepEqual(t.rows, [{ kind: 'probe', zone: 'H1-F1-SENSOR', at: AT, ms: '', status: 'trung' }]);
});

test('tracker: khoa da thay truoc khi gui thi tu choi gui (se bi coi la trung)', () => {
  const t = createTracker(5000);
  t.received(ev({ value: 27.9 }), 900);
  assert.equal(t.sent({ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.01, at: AT }, 1000), false);
  assert.equal(t.pending(), 0);
});

test('alertValues: mo = Max + 1,5; dong = Target, khong co Target thi Max - 2; khong co Max thi null', () => {
  assert.deepEqual(alertValues({ maxValue: 30, targetValue: 28 }), { high: 31.5, close: 28 });
  assert.deepEqual(alertValues({ maxValue: 30.25, targetValue: null }), { high: 31.75, close: 28.25 });
  assert.equal(alertValues({ maxValue: null, targetValue: 28 }), null);
  assert.equal(alertValues(undefined), null);
});

test('isProbeAlert: chi ghep canh bao THRESHOLD cung khu vuc, chi so va gia tri da gui', () => {
  const probe = { zoneId: 7, metric: 'TEMP', value: 31.5 };
  const a = { alertType: 'THRESHOLD', zoneId: 7, metricCode: 'TEMP', value: 31.5 };
  assert.equal(isProbeAlert(a, probe), true);
  assert.equal(isProbeAlert({ ...a, zoneId: 8 }, probe), false);
  assert.equal(isProbeAlert({ ...a, metricCode: 'HUMID' }, probe), false);
  assert.equal(isProbeAlert({ ...a, value: 30.4 }, probe), false); // canh bao do so do khac mo
  assert.equal(isProbeAlert({ ...a, alertType: 'DEVICE_OFFLINE' }, probe), false);
});

test('alertStatus: co canh bao -> ok; so do bi CSDL bo vi trung giay -> trung; so do toi ma khong mo -> khong-mo; khong thay gi -> mat', () => {
  assert.equal(alertStatus(true, undefined), 'ok');
  assert.equal(alertStatus(false, { status: 'trung' }), 'trung');
  assert.equal(alertStatus(false, { status: 'ok' }), 'khong-mo');
  assert.equal(alertStatus(false, { status: 'mat' }), 'mat');
  assert.equal(alertStatus(false, undefined), 'mat');
});
