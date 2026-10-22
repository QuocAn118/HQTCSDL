import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseNow, expand, match, loadChain } from '../lib/fixtures.mjs';

const ctx = {
  now: new Date('2026-10-14T10:42:13Z'),
  ref: (kind, key) => ({ 'house:H1': 1, 'device:H1-F1-FAN': 17 })[`${kind}:${key}`] ?? assert.fail(`ref la ${kind}:${key}`),
  token: (u) => `tok-${u}`,
  serviceKey: 'svc',
  devPassword: 'pw',
};

test('baseNow: lam tron xuong giay, tranh luoi 5 phut', () => {
  assert.equal(baseNow(new Date('2026-10-14T10:40:00.500Z')).toISOString(), '2026-10-14T10:40:07.000Z');
  assert.equal(baseNow(new Date('2026-10-14T10:41:00.000Z')).toISOString(), '2026-10-14T10:41:00.000Z');
  assert.equal(baseNow(new Date('2026-10-14T10:40:03.900Z')).toISOString(), '2026-10-14T10:40:03.000Z');
});

test('expand: moc thoi gian', () => {
  const out = expand({
    a: '{{now}}', b: '{{now-30s}}', c: '{{now-10m}}', d: '{{now+1h}}',
    e: '{{window}}', f: '{{window-5m}}', g: '{{window+1m}}',
    h: '{{now:noZ}}', i: '{{now:+07:00}}', j: '{{window:noZ}}', k: '{{now-1h:noZ}}',
  }, ctx);
  assert.deepEqual(out, {
    a: '2026-10-14T10:42:13Z', b: '2026-10-14T10:41:43Z', c: '2026-10-14T10:32:13Z', d: '2026-10-14T11:42:13Z',
    e: '2026-10-14T10:40:00Z', f: '2026-10-14T10:35:00Z', g: '2026-10-14T10:41:00Z',
    h: '2026-10-14T10:42:13', i: '2026-10-14T17:42:13+07:00', j: '2026-10-14T10:40:00', k: '2026-10-14T09:42:13',
  });
});

test('expand: ref nguyen chuoi -> so, trong duong dan -> chu so; token, khoa', () => {
  const out = expand({
    houseId: '{{ref:house:H1}}',
    path: '/api/devices/{{ref:device:H1-F1-FAN}}/control?h={{ref:house:H1}}',
    auth: 'Bearer {{token:owner1}}', key: '{{serviceKey}}', pw: '{{devPassword}}',
    list: [{ at: '{{now}}' }], n: 5, z: null, t: true,
  }, ctx);
  assert.deepEqual(out, {
    houseId: 1, path: '/api/devices/17/control?h=1', auth: 'Bearer tok-owner1', key: 'svc', pw: 'pw',
    list: [{ at: '2026-10-14T10:42:13Z' }], n: 5, z: null, t: true,
  });
});

test('expand: giu nguyen bo so khop, cho giu cho la -> loi', () => {
  assert.deepEqual(expand({ id: '{{any:id}}', m: '{{any:string}}' }, ctx), { id: '{{any:id}}', m: '{{any:string}}' });
  assert.throws(() => expand('{{bogus}}', ctx), /bogus/);
  assert.throws(() => expand('{{now-5x}}', ctx), /now-5x/);
});

test('match: bo so khop', () => {
  assert.deepEqual(match({ a: '{{any:id}}' }, { a: 3 }), []);
  for (const bad of [0, -1, 1.5, '3', null]) assert.equal(match({ a: '{{any:id}}' }, { a: bad }).length, 1);
  assert.deepEqual(match('{{any:iso}}', '2026-10-14T10:42:13.000Z'), []);
  assert.equal(match('{{any:iso}}', '2026-10-14T17:42:13+07:00').length, 1);
  assert.equal(match('{{any:iso}}', '2026-10-14T10:42:13').length, 1);
  assert.deepEqual(match('{{any:string}}', 'x'), []);
  assert.equal(match('{{any:string}}', '').length, 1);
});

test('match: tap khoa chinh xac, mang, moc thoi gian theo thoi diem', () => {
  assert.equal(match({ a: 1 }, { a: 1, b: 2 }).length, 1);
  assert.equal(match({ a: 1, b: 2 }, { a: 1 }).length, 1);
  assert.equal(match([1, 2], [1]).length, 1);
  assert.deepEqual(match({ at: '2026-10-14T10:42:13Z' }, { at: '2026-10-14T10:42:13.000Z' }), []);
  assert.equal(match({ at: '2026-10-14T10:42:13Z' }, { at: '2026-10-14T10:42:14.000Z' }).length, 1);
  assert.deepEqual(match({ m: 'Nhiệt độ' }, { m: 'Nhiệt độ' }), []);
  assert.match(match({ a: { b: 1 } }, { a: { b: 2 } })[0], /\$\.a\.b/);
  assert.equal(match({ v: null }, { v: 0 }).length, 1);
});

test('loadChain: theo after, cai chay truoc dung truoc; vong lap -> loi', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fx-'));
  mkdirSync(join(dir, 'rest'));
  mkdirSync(join(dir, 'ws'));
  writeFileSync(join(dir, 'rest', 'a.json'), '{"method":"GET"}');
  writeFileSync(join(dir, 'rest', 'b.json'), '{"after":"rest/a"}');
  writeFileSync(join(dir, 'ws', 'c.json'), '{"after":"rest/b"}');
  assert.deepEqual(loadChain('ws/c', dir).map((x) => x.name), ['rest/a', 'rest/b', 'ws/c']);
  writeFileSync(join(dir, 'rest', 'a.json'), '{"after":"ws/c"}');
  assert.throws(() => loadChain('ws/c', dir), /vong lap/);
});
