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
    'command.manual.json', 'command.auto.json',
  ],
  ai: [
    'bird-counts.json', 'bird-counts.resend-smaller.json',
    'predator-detection.json', 'snake.jpg', 'predator-detection.cooldown.json', 'predator-detection.low-confidence.json',
    'heartbeat.cut.json',
    'bird-counts.invalid-window-not-aligned.json', 'bird-counts.invalid-negative.json', 'bird-counts.invalid-missing-z.json',
    'predator-detection.invalid-class.json', 'predator-detection.invalid-offset.json',
    'predator-detection.invalid-not-jpeg.json', 'not-jpeg.png', 'ai.invalid-service-key.json',
  ],
  rest: [
    'auth-login.json', 'control.manual.json', 'control.auto-without-ison.json', 'alert-ack.json',
    'alerts-list.page.json', 'readings-history.json', 'thresholds-put.json', 'health.json',
    'harvests-post.cut.json', 'report-env-vs-yield.cut.json',
    'auth-login.invalid-credentials.json', 'control.invalid-not-controllable.json', 'alert.invalid-transition.json',
    'readings-history.invalid-range.json', 'readings-history.invalid-missing-z.json',
    'thresholds-put.invalid-min-max.json', 'house.invalid-not-owner.json', 'users.invalid-modify-self.json',
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

// ---------- Loi HTTP (bang doi ma spec 3.5) ----------
const SQL_ERRORS = {
  50003: [409, 'DEVICE_NOT_CONTROLLABLE'], 50010: [404, 'CAMERA_NOT_FOUND'],
  50012: [400, 'VALIDATION_ERROR'], 50013: [400, 'VALIDATION_ERROR'], 50014: [400, 'VALIDATION_ERROR'],
  50020: [404, 'ALERT_NOT_FOUND'], 50021: [409, 'ALERT_INVALID_TRANSITION'], 50030: [400, 'INVALID_JSON'],
  50040: [400, 'INVALID_PARAMETER'], 50041: [400, 'INVALID_PARAMETER'], 50042: [400, 'INVALID_PARAMETER'],
  547: [400, 'CONSTRAINT_VIOLATION'], 2627: [409, 'DUPLICATE'], 2601: [409, 'DUPLICATE'], 1205: [503, 'RETRY_LATER'],
};
const APP_ERRORS = {
  VALIDATION_ERROR: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CANNOT_MODIFY_SELF: 409,
  LAST_ADMIN: 409, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, INTERNAL: 500,
};
const SQL_FIELDS = { 50012: ['in', 'out'], 50013: ['class'], 50014: ['windowStart'] };

function errorProblems(f) {
  if (!sameKeys(f.response, ['error'])) return ['phan hoi loi phai la {error:{…}}'];
  const e = f.response.error;
  if (!sameKeys(e, ['code', 'message', 'sqlNumber', 'details'])) return ['error phai co dung code, message, sqlNumber, details'];
  const p = [];
  if (e.message !== '{{any:string}}') p.push('message phai la {{any:string}} (khong khoa nguyen van)');
  if (e.sqlNumber !== null) {
    const m = SQL_ERRORS[e.sqlNumber];
    if (!m) p.push(`sqlNumber ${e.sqlNumber} khong co trong bang 3.5`);
    else if (m[0] !== f.status || m[1] !== e.code) p.push(`sqlNumber ${e.sqlNumber} phai la HTTP ${m[0]} ${m[1]}`);
  } else if (APP_ERRORS[e.code] !== f.status) {
    p.push(`${e.code} phai di voi HTTP ${APP_ERRORS[e.code]}`);
  }
  if (e.code === 'VALIDATION_ERROR') {
    const fields = e.details?.fields;
    if (!sameKeys(e.details, ['fields']) || !Array.isArray(fields) || fields.length === 0) p.push('details phai la {fields:[…]}');
    else if (SQL_FIELDS[e.sqlNumber] && JSON.stringify(fields) !== JSON.stringify(SQL_FIELDS[e.sqlNumber])) {
      p.push(`details.fields cua ${e.sqlNumber} phai la ${JSON.stringify(SQL_FIELDS[e.sqlNumber])}`);
    }
  } else if (e.details !== null) {
    p.push('details phai la null');
  }
  return p;
}

function httpProblems(file, f) {
  if (isInvalid(file)) return f.status >= 400 ? errorProblems(f) : ['fixture invalid phai co status >= 400'];
  return [200, 201].includes(f.status) ? [] : ['fixture hop le phai co status 200 hoac 201'];
}

test('ai, rest: ma HTTP, phan hoi loi, file dinh kem', () => {
  for (const folder of ['ai', 'rest'].filter((x) => EXPECTED[x])) {
    for (const file of jsonFiles(folder)) {
      const f = load(folder, file);
      assert.deepEqual(httpProblems(file, f), [], `${folder}/${file}`);
      for (const v of Object.values(f.body ?? {})) {
        if (typeof v === 'string' && v.startsWith('@')) {
          assert.ok(EXPECTED[folder].includes(v.slice(1)), `${folder}/${file}: file dinh kem ${v} khong co`);
        }
      }
    }
  }
});

// ---------- AI ----------
const PREDATOR_CLASSES = ['rat', 'snake', 'owl'];

function aiProblems(f) {
  const b = f.body;
  if (f.method !== 'POST') return ['endpoint AI deu la POST'];
  if (f.path === '/api/ai/bird-counts') {
    if (!Array.isArray(b)) return ['body phai la mang'];
    return b.flatMap((x, i) => [
      !sameKeys(x, ['camera', 'windowStart', 'in', 'out']) && `[${i}] khoa phai la camera, windowStart, in, out`,
      !ISO_Z.test(x?.windowStart) && `[${i}] windowStart phai la UTC co Z`,
      ISO_Z.test(x?.windowStart) && Date.parse(x.windowStart) % 300_000 !== 0 && `[${i}] windowStart phai dung moc 5 phut`,
      !(Number.isInteger(x?.in) && x.in >= 0 && Number.isInteger(x?.out) && x.out >= 0) && `[${i}] in, out phai la so nguyen >= 0`,
    ].filter(Boolean));
  }
  if (f.path === '/api/ai/predator-detections') {
    const m = b?.metadata;
    return [
      !sameKeys(b, ['metadata', 'image']) && 'body multipart phai co metadata, image',
      !sameKeys(m, ['camera', 'class', 'confidence', 'at']) && 'metadata phai co camera, class, confidence, at (khong co snapshot)',
      !PREDATOR_CLASSES.includes(m?.class) && 'class phai la rat | snake | owl',
      !(typeof m?.confidence === 'number' && m.confidence >= 0 && m.confidence <= 1) && 'confidence phai trong [0, 1]',
      !ISO_Z.test(m?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  if (f.path === '/api/ai/heartbeat') {
    return [
      !sameKeys(b, ['device', 'at']) && 'khoa phai la device, at',
      !ISO_Z.test(b?.at) && 'at phai la UTC co Z',
    ].filter(Boolean);
  }
  return [`duong dan AI la: ${f.path}`];
}

// Fixture invalid ma ly do nam o body (AI phai tu tranh); cac invalid con lai co body dung.
const AI_BODY_INVALID = {
  'bird-counts.invalid-window-not-aligned.json': /moc 5 phut/,
  'bird-counts.invalid-negative.json': /so nguyen >= 0/,
  'bird-counts.invalid-missing-z.json': /UTC co Z/,
  'predator-detection.invalid-class.json': /rat \| snake \| owl/,
  'predator-detection.invalid-offset.json': /UTC co Z/,
};

test('ai: header X-Service-Key, body dung hop dong', () => {
  for (const file of jsonFiles('ai')) {
    const f = expand(load('ai', file), ctx);
    assert.ok(sameKeys(f.headers, ['X-Service-Key']), `${file}: headers chi gom X-Service-Key`);
    if (file !== 'ai.invalid-service-key.json') assert.equal(f.headers['X-Service-Key'], ctx.serviceKey, `${file}: dung {{serviceKey}}`);
    const problems = aiProblems(f);
    if (AI_BODY_INVALID[file]) assert.ok(problems.some((p) => AI_BODY_INVALID[file].test(p)), `${file}: ${problems.join('; ')}`);
    else assert.deepEqual(problems, [], file);
  }
});

test('ai: anh mau - snake.jpg la JPEG that <= 2 MB, not-jpeg.png khong phai JPEG', () => {
  const jpg = readFileSync(join(FIXTURES_DIR, 'ai', 'snake.jpg'));
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.ok(jpg.length > 0 && jpg.length <= 2 * 1024 * 1024);
  const png = readFileSync(join(FIXTURES_DIR, 'ai', 'not-jpeg.png'));
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

// ---------- REST ----------
const ALERT_KEYS = ['alertId', 'houseId', 'zoneId', 'deviceId', 'alertType', 'severity', 'metricCode', 'value',
  'detectedClass', 'confidence', 'hasSnapshot', 'message', 'status', 'createdAt'];
const USER_KEYS = ['userId', 'username', 'fullName', 'email', 'phone', 'role', 'isActive'];
const CONTROL_KEYS = ['changed', 'deviceCode', 'mode', 'isOn', 'level'];
// Phan hoi la object: tap khoa (bo sung hop dong B10).
const REST_OBJECT_KEYS = {
  'auth-login.json': ['accessToken', 'expiresIn', 'user'],
  'control.manual.json': CONTROL_KEYS,
  'control.auto-without-ison.json': CONTROL_KEYS,
  'alert-ack.json': ['alertId', 'houseId', 'zoneId', 'alertType', 'status', 'resolvedAt', 'resolvedBy'],
  'alerts-list.page.json': ['items', 'nextBefore'],
  'thresholds-put.json': ['zoneId', 'metricCode', 'minValue', 'maxValue', 'targetValue', 'updatedBy', 'updatedAt'],
  'health.json': ['status', 'db', 'mqtt'],
  'harvests-post.cut.json': ['harvestId', 'zoneId', 'harvestDate', 'nestCount', 'weightGram', 'grade', 'recordedBy', 'createdAt'],
};
// Phan hoi la mang dong: tap khoa moi dong.
const REST_ROW_KEYS = {
  'readings-history.json': ['bucketUtc', 'avgValue', 'minValue', 'maxValue'],
  'report-env-vs-yield.cut.json': ['zoneId', 'zoneName', 'monthVn', 'avgTemp', 'stdevTemp', 'avgHumid', 'stdevHumid',
    'pctInRange', 'nestCount', 'weightGram'],
};
const REST_CREATED = ['harvests-post.cut.json']; // B8: POST tao tai nguyen -> 201
const REST_PUBLIC = ['auth-login.json', 'auth-login.invalid-credentials.json', 'health.json'];

test('rest: xac thuc, ma thanh cong, tap khoa phan hoi', () => {
  for (const file of jsonFiles('rest')) {
    const f = load('rest', file);
    if (REST_PUBLIC.includes(file)) assert.equal(f.headers, undefined, `${file}: route cong khai khong gui header`);
    else assert.match(f.headers?.Authorization ?? '', /^Bearer \{\{token:\w+\}\}$/, `${file}: can Authorization: Bearer {{token:…}}`);
    if (isInvalid(file)) continue;
    assert.equal(f.status, REST_CREATED.includes(file) ? 201 : 200, `${file}: ma thanh cong`);
    if (REST_OBJECT_KEYS[file]) {
      assert.ok(sameKeys(f.response, REST_OBJECT_KEYS[file]), `${file}: khoa phan hoi`);
    } else {
      assert.ok(REST_ROW_KEYS[file], `${file}: chua khai bao dang phan hoi trong test`);
      assert.ok(Array.isArray(f.response) && f.response.every((r) => sameKeys(r, REST_ROW_KEYS[file])), `${file}: khoa tung dong`);
    }
  }
  assert.ok(sameKeys(load('rest', 'auth-login.json').response.user, USER_KEYS), 'auth-login: khoa user');
  for (const item of load('rest', 'alerts-list.page.json').response.items) {
    assert.deepEqual(Object.keys(item), ALERT_KEYS, 'alerts-list: 14 khoa canh bao dung thu tu');
  }
});

test('mqtt command: khop ket qua control tuong ung', () => {
  for (const [cmd, ctl] of [['command.manual.json', 'rest/control.manual'], ['command.auto.json', 'rest/control.auto-without-ison']]) {
    const c = load('mqtt', cmd);
    const r = loadFixture(ctl).response;
    assert.equal(c.after, ctl, `${cmd}: after`);
    assert.equal(c.topic, `swiftlet/devices/${r.deviceCode}/command`, `${cmd}: topic tu deviceCode`);
    assert.deepEqual({ isOn: c.payload.isOn, level: c.payload.level, mode: c.payload.mode },
      { isOn: r.isOn, level: r.level, mode: r.mode }, `${cmd}: payload = ket qua sp_SetActuator`);
  }
});

// <!-- TEST-APPEND -->
