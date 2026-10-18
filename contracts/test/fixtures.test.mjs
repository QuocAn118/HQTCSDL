// Kiem fixture khop hop dong (spec integration-contract 4.3), khong can CSDL hay broker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR, baseNow, expand, loadFixture } from '../lib/fixtures.mjs';
import { SEED_REFS } from '../lib/seed-refs.mjs';

// Danh sach file theo bang fixture spec 4.3; moi task them thu muc / file cua minh.
const EXPECTED = {
  mqtt: [
    'readings.json', 'heartbeat.cut.json',
    'readings.invalid-missing-z.json', 'readings.invalid-offset.json',
    'readings.invalid-device-mismatch.json', 'readings.invalid-not-array.json',
  ],
};

const SHAPE = {
  mqtt: { required: ['topic', 'payload'], optional: ['after'] },
  ai: { required: ['method', 'path', 'status', 'response'], optional: ['headers', 'body', 'after'] },
  rest: { required: ['method', 'path', 'status', 'response'], optional: ['headers', 'body', 'after'] },
  ws: { required: ['event', 'payload'], optional: ['after'] },
};

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const METRICS = ['TEMP', 'HUMID', 'CO2', 'LIGHT'];

// ref/token chi hop le khi co trong seed; gia tri tra ve khong quan trong voi test cau truc.
const ctx = {
  now: baseNow(),
  ref: (kind, key) => {
    assert.ok(SEED_REFS[kind]?.includes(key), `ref khong co trong seed: ${kind}:${key}`);
    return 1;
  },
  token: (u) => {
    assert.ok(SEED_REFS.user.includes(u), `token cho nguoi dung la: ${u}`);
    return 'test-token';
  },
  serviceKey: 'test-service-key',
  devPassword: 'test-password',
};

const sameKeys = (obj, keys) => obj !== null && typeof obj === 'object' && !Array.isArray(obj)
  && JSON.stringify(Object.keys(obj).sort()) === JSON.stringify([...keys].sort());
const jsonFiles = (folder) => EXPECTED[folder].filter((f) => f.endsWith('.json'));
const load = (folder, file) => loadFixture(`${folder}/${file.replace(/\.json$/, '')}`);
const isInvalid = (file) => file.includes('.invalid-');

test('thu muc fixture: dung va du danh sach spec 4.3', () => {
  assert.deepEqual(readdirSync(FIXTURES_DIR).sort(), Object.keys(EXPECTED).sort());
  for (const [folder, files] of Object.entries(EXPECTED)) {
    assert.deepEqual(readdirSync(join(FIXTURES_DIR, folder)).sort(), [...files].sort(), folder);
  }
});

for (const folder of Object.keys(EXPECTED)) {
  for (const file of jsonFiles(folder)) {
    test(`${folder}/${file}: ma hoa, khung, khong moc/id co dinh, cho giu cho hop le`, () => {
      const raw = readFileSync(join(FIXTURES_DIR, folder, file));
      assert.notDeepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'file co BOM - luu lai UTF-8 khong BOM');
      const text = raw.toString('utf8');
      assert.ok(!text.includes('�'), 'ky tu hong - file khong phai UTF-8');
      assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'moc thoi gian co dinh - dung {{now…}} / {{window…}}');
      assert.doesNotMatch(text, /"(\w+Id|nextBefore)"\s*:\s*\d/, 'id co dinh - dung {{ref:…}} hoac {{any:id}}');
      assert.doesNotMatch(text, /\/api\/[\w-]+\/\d/, 'id co dinh trong duong dan - dung {{ref:…}}');
      const f = JSON.parse(text);
      const { required, optional } = SHAPE[folder];
      assert.deepEqual(required.filter((k) => !Object.hasOwn(f, k)), [], 'thieu khoa');
      assert.deepEqual(Object.keys(f).filter((k) => !required.includes(k) && !optional.includes(k)), [], 'khoa la');
      if (f.after) assert.ok(existsSync(join(FIXTURES_DIR, `${f.after}.json`)), `after tro toi file khong co: ${f.after}`);
      expand(f, ctx); // nem loi neu cho giu cho la hoac ref ngoai seed
    });
  }
}

// ---------- MQTT ----------
const MQTT_TOPIC = /^swiftlet\/devices\/([A-Z0-9-]+)\/(readings|heartbeat|command)$/;

function mqttProblems(f) {
  const t = MQTT_TOPIC.exec(f.topic);
  if (!t) return ['topic sai dang swiftlet/devices/{code}/(readings|heartbeat|command)'];
  const [, code, kind] = t;
  const p = f.payload;
  if (kind === 'readings') {
    if (!Array.isArray(p)) return ['readings phai la mang'];
    return p.flatMap((r, i) => [
      !sameKeys(r, ['device', 'metric', 'value', 'at']) && `[${i}] khoa phai la device, metric, value, at`,
      r?.device !== code && `[${i}] device khac {code} cua topic`,
      !METRICS.includes(r?.metric) && `[${i}] metric la`,
      typeof r?.value !== 'number' && `[${i}] value phai la so`,
      !ISO_Z.test(r?.at) && `[${i}] at phai la UTC co Z`,
    ].filter(Boolean));
  }
  if (kind === 'heartbeat') {
    return [
      !sameKeys(p, ['device', 'at']) && 'khoa phai la device, at',
      p?.device !== code && 'device khac {code} cua topic',
      !ISO_Z.test(p?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  // command: trang thai mong muon do backend publish (retained).
  return [
    !sameKeys(p, ['isOn', 'level', 'mode', 'issuedAt']) && 'khoa phai la isOn, level, mode, issuedAt',
    typeof p?.isOn !== 'boolean' && 'isOn phai la boolean',
    !(p?.level === null || (Number.isInteger(p?.level) && p.level >= 0 && p.level <= 100)) && 'level 0-100 hoac null',
    !['AUTO', 'MANUAL'].includes(p?.mode) && 'mode phai la AUTO | MANUAL',
    p?.issuedAt !== '{{any:iso}}' && 'issuedAt do backend sinh -> {{any:iso}}',
  ].filter(Boolean);
}

test('mqtt: fixture hop le dung hop dong', () => {
  for (const file of jsonFiles('mqtt').filter((f) => !isInvalid(f))) {
    assert.deepEqual(mqttProblems(expand(load('mqtt', file), ctx)), [], file);
  }
});

test('mqtt: fixture khong hop le bi bat dung ly do', () => {
  const reasons = {
    'readings.invalid-missing-z.json': /at phai la UTC/,
    'readings.invalid-offset.json': /at phai la UTC/,
    'readings.invalid-device-mismatch.json': /device khac/,
    'readings.invalid-not-array.json': /phai la mang/,
  };
  assert.deepEqual(Object.keys(reasons).sort(), jsonFiles('mqtt').filter(isInvalid).sort());
  for (const [file, re] of Object.entries(reasons)) {
    const problems = mqttProblems(expand(load('mqtt', file), ctx));
    assert.ok(problems.some((p) => re.test(p)), `${file}: ${problems.join('; ')}`);
  }
});

// <!-- TEST-APPEND -->
