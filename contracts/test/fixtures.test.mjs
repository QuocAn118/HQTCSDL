// Kiem fixture khop hop dong (spec integration-contract 4.3), khong can CSDL hay broker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES_DIR, baseNow, expand, loadChain, loadFixture } from '../lib/fixtures.mjs';
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
  ws: [
    'readings.new.json', 'alert.created.threshold.json', 'alert.created.predator.json',
    'alert.updated.json', 'device.state.json', 'birdcount.updated.json',
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
      assert.doesNotMatch(text, /[ÃÂÄÆ][\u0080-¿]|á»|Ä‘/, 'mojibake - UTF-8 bi doc nhu Windows-1252 roi luu lai');
      assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'moc thoi gian co dinh - dung {{now…}} / {{window…}}');
      assert.doesNotMatch(text, /"(\w+Id|nextBefore)"\s*:\s*\d/, 'id co dinh - dung {{ref:…}} hoac {{any:id}}');
      assert.doesNotMatch(text, /\/api\/[\w-]+\/\d/, 'id co dinh trong duong dan - dung {{ref:…}}');
      const f = JSON.parse(text);
      if (f.path) {
        assert.doesNotMatch(f.path, /\/\d/, 'id co dinh trong doan duong dan - dung {{ref:…}}');
        assert.doesNotMatch(f.path, /[?&]\w*(Id|before)=\d/, 'id co dinh trong query - dung {{ref:…}}');
      }
      const { required, optional } = SHAPE[folder];
      assert.deepEqual(required.filter((k) => !Object.hasOwn(f, k)), [], 'thieu khoa');
      assert.deepEqual(Object.keys(f).filter((k) => !required.includes(k) && !optional.includes(k)), [], 'khoa la');
      if (f.after) assert.ok(existsSync(join(FIXTURES_DIR, `${f.after}.json`)), `after tro toi file khong co: ${f.after}`);
      expand(f, ctx); // nem loi neu cho giu cho la hoac ref ngoai seed
    });
  }
}

test('chuoi after: moi fixture nap duoc ca chuoi, khong vong lap, expand chung mot ctx', () => {
  for (const folder of Object.keys(EXPECTED)) {
    for (const file of jsonFiles(folder)) {
      for (const { fixture } of loadChain(`${folder}/${file.replace(/\.json$/, '')}`)) expand(fixture, ctx);
    }
  }
});

test('tieng Viet giu nguyen (khong mojibake, khong bi thay bang ?)', () => {
  assert.equal(loadFixture('rest/alert-ack').body.note, 'Đã kiểm tra');
  assert.equal(loadFixture('rest/control.manual').body.reason, 'Thử điều khiển tay');
  assert.equal(loadFixture('rest/auth-login').response.user.fullName, 'Chủ nhà yến H1');
  assert.equal(loadFixture('rest/alerts-list.page').response.items[0].message, 'Phát hiện rắn tại H1-F0-CAMERA (độ tin cậy 91.0%)');
  assert.equal(loadFixture('ws/alert.created.predator').payload.alert.message, 'Phát hiện rắn tại H1-F0-CAMERA (độ tin cậy 87.0%)');
  assert.equal(loadFixture('ws/alert.created.threshold').payload.alert.message, 'Nhiệt độ vượt ngưỡng trên 30.00 °C: 31.20 °C');
});

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
  50001: [500, 'INTERNAL'], 50002: [500, 'INTERNAL'], 50003: [409, 'DEVICE_NOT_CONTROLLABLE'], 50010: [404, 'CAMERA_NOT_FOUND'],
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

// Moi fixture invalid ghim dung loi theo bang spec 4.3 (ma trong ngoac) va B7 (details.fields).
const INVALID_EXPECTED = {
  'ai/bird-counts.invalid-window-not-aligned.json': [400, 'VALIDATION_ERROR', 50014, ['windowStart']],
  'ai/bird-counts.invalid-negative.json': [400, 'VALIDATION_ERROR', 50012, ['in', 'out']],
  'ai/bird-counts.invalid-missing-z.json': [400, 'VALIDATION_ERROR', null, ['windowStart']],
  'ai/predator-detection.invalid-class.json': [400, 'VALIDATION_ERROR', null, ['class']],
  'ai/predator-detection.invalid-offset.json': [400, 'VALIDATION_ERROR', null, ['at']],
  'ai/predator-detection.invalid-not-jpeg.json': [415, 'UNSUPPORTED_MEDIA_TYPE', null, null],
  'ai/ai.invalid-service-key.json': [401, 'UNAUTHENTICATED', null, null],
  'rest/auth-login.invalid-credentials.json': [401, 'UNAUTHENTICATED', null, null],
  'rest/control.invalid-not-controllable.json': [409, 'DEVICE_NOT_CONTROLLABLE', 50003, null],
  'rest/alert.invalid-transition.json': [409, 'ALERT_INVALID_TRANSITION', 50021, null],
  'rest/readings-history.invalid-range.json': [400, 'INVALID_PARAMETER', 50041, null],
  'rest/readings-history.invalid-missing-z.json': [400, 'VALIDATION_ERROR', null, ['from']],
  'rest/thresholds-put.invalid-min-max.json': [400, 'CONSTRAINT_VIOLATION', 547, null],
  'rest/house.invalid-not-owner.json': [404, 'NOT_FOUND', null, null],
  'rest/users.invalid-modify-self.json': [409, 'CANNOT_MODIFY_SELF', null, null],
};

test('ai, rest: fixture invalid dung loi spec 4.3, dau vao that su sai', () => {
  const invalid = ['ai', 'rest'].flatMap((d) => jsonFiles(d).filter(isInvalid).map((f) => `${d}/${f}`));
  assert.deepEqual(invalid.sort(), Object.keys(INVALID_EXPECTED).sort());
  for (const [name, [status, code, sqlNumber, fields]] of Object.entries(INVALID_EXPECTED)) {
    const f = loadFixture(name.replace(/\.json$/, ''));
    const e = f.response.error;
    assert.deepEqual([f.status, e.code, e.sqlNumber, e.details?.fields ?? null], [status, code, sqlNumber, fields], name);
  }
  // REST: ly do nam o dau vao, kiem dau vao that su sai (AI da kiem o AI_BODY_INVALID).
  assert.match(loadFixture('rest/readings-history.invalid-missing-z').path, /from=\{\{now[^}]*:noZ\}\}/);
  const mm = loadFixture('rest/thresholds-put.invalid-min-max').body;
  assert.ok(mm.minValue >= mm.maxValue, 'min-max: minValue phai >= maxValue');
  const range = expand(loadFixture('rest/readings-history.invalid-range'), ctx).path;
  const [from, to] = ['from', 'to'].map((k) => Date.parse(new URLSearchParams(range.split('?')[1]).get(k)));
  assert.ok(from >= to, 'invalid-range: from phai >= to');
  assert.equal(loadFixture('rest/auth-login.invalid-credentials').body.password.includes('{{devPassword}}'), false);
  const self = loadFixture('rest/users.invalid-modify-self');
  assert.equal(self.path, `/api/users/{{ref:user:${self.headers.Authorization.match(/token:(\w+)/)[1]}}}`, 'modify-self: sua chinh minh');
  const other = loadFixture('rest/house.invalid-not-owner');
  const owned = { owner1: 'H1', owner2: 'H2' }[other.headers.Authorization.match(/token:(\w+)/)[1]]; // seed: chu nha
  assert.ok(owned && !other.path.includes(`{{ref:house:${owned}}}`), 'not-owner: phai doc nha cua nguoi khac');
});

test('bang 3.5: 50001, 50002 la loi backend -> 500 INTERNAL', () => {
  for (const sqlNumber of [50001, 50002]) {
    const f = { status: 500, response: { error: { code: 'INTERNAL', message: '{{any:string}}', sqlNumber, details: null } } };
    assert.deepEqual(errorProblems(f), [], String(sqlNumber));
  }
});

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

// B8: endpoint AI la POST hanh dong -> 200; B10 / spec 2.4: tap khoa phan hoi.
const AI_RESPONSE_KEYS = {
  '/api/ai/bird-counts': ['windowsUpserted', 'windowsUnchanged'],
  '/api/ai/predator-detections': ['created', 'alertId', 'skipReason'],
  '/api/ai/heartbeat': ['accepted', 'rejected'],
};

test('ai: header X-Service-Key, body dung hop dong', () => {
  for (const file of jsonFiles('ai')) {
    const f = expand(load('ai', file), ctx);
    if (!isInvalid(file)) {
      assert.equal(f.status, 200, `${file}: endpoint AI tra 200`);
      assert.ok(sameKeys(f.response, AI_RESPONSE_KEYS[f.path] ?? []), `${file}: khoa phan hoi`);
    }
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

test('rest bao cao: thang thu hoach khong trung thang thu hoach seed', () => {
  // Seed 90-harvests: H1 F1-F3 ngay 10 thang neo (2026-10) va 2 thang truoc -> trung thang thi bao cao ra them dong.
  const month = load('rest', 'harvests-post.cut.json').body.harvestDate.slice(0, 7);
  assert.ok(!['2026-08', '2026-09', '2026-10'].includes(month), `thang ${month} co thu hoach seed`);
  const report = load('rest', 'report-env-vs-yield.cut.json');
  assert.deepEqual(report.response.map((r) => r.monthVn), [month]);
  assert.match(report.path, new RegExp(`fromVnDate=${month}-01&`));
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

// ---------- WebSocket (spec 4.2) ----------
const WS_PAYLOAD_KEYS = {
  'readings.new': ['houseId', 'readings'],
  'alert.created': ['alert'],
  'alert.updated': ['alertId', 'houseId', 'status', 'resolvedAt', 'resolvedBy'],
  'device.state': ['deviceId', 'deviceCode', 'houseId', 'zoneId', 'mode', 'isOn', 'level', 'source', 'at'],
  'birdcount.updated': ['houseId', 'cameraId'],
};

test('ws: moi su kien co fixture, ten file, tap khoa, luon co houseId', () => {
  const events = jsonFiles('ws').map((file) => load('ws', file).event);
  assert.deepEqual([...new Set(events)].sort(), Object.keys(WS_PAYLOAD_KEYS).sort(), 'moi su kien spec 4.2 co it nhat mot fixture');
  for (const file of jsonFiles('ws')) {
    const f = load('ws', file);
    assert.ok(file.startsWith(`${f.event}.`), `${file}: ten file bat dau bang ten su kien`);
    assert.ok(f.after, `${file}: phai co after (hanh dong sinh ra su kien)`);
    assert.ok(sameKeys(f.payload, WS_PAYLOAD_KEYS[f.event] ?? []), `${file}: khoa payload`);
    const houseId = f.event === 'alert.created' ? f.payload.alert.houseId : f.payload.houseId;
    assert.match(String(houseId), /^\{\{ref:house:H\d\}\}$/, `${file}: phai co houseId de chon phong house:{id}`);
    if (f.event === 'alert.created') assert.deepEqual(Object.keys(f.payload.alert), ALERT_KEYS, `${file}: 14 khoa canh bao, khong co snapshotPath`);
    if (f.event === 'readings.new') {
      for (const r of f.payload.readings) {
        assert.ok(sameKeys(r, ['deviceId', 'deviceCode', 'zoneId', 'metric', 'value', 'at']), `${file}: khoa so do`);
      }
    }
  }
});

test('ws readings.new: dung cac so do mqtt/readings da gui, cung thu tu', () => {
  const sent = loadFixture('mqtt/readings').payload;
  const got = load('ws', 'readings.new.json').payload.readings;
  assert.deepEqual(got.map((r) => [r.deviceCode, r.metric, r.value, r.at]), sent.map((r) => [r.device, r.metric, r.value, r.at]));
});

test('ws: gia tri khop fixture sinh ra su kien', () => {
  const ctl = loadFixture('rest/control.manual').response;
  const ds = load('ws', 'device.state.json').payload;
  assert.deepEqual([ds.deviceCode, ds.mode, ds.isOn, ds.level], [ctl.deviceCode, ctl.mode, ctl.isOn, ctl.level], 'device.state = rest/control.manual');
  const ack = loadFixture('rest/alert-ack').response;
  const up = load('ws', 'alert.updated.json').payload;
  for (const k of ['alertId', 'houseId', 'status', 'resolvedAt', 'resolvedBy']) assert.equal(up[k], ack[k], `alert.updated.${k} = rest/alert-ack`);
  const det = loadFixture('ai/predator-detection').body.metadata;
  const pa = load('ws', 'alert.created.predator.json').payload.alert;
  assert.deepEqual([pa.detectedClass, pa.confidence, pa.createdAt], [det.class, det.confidence, det.at], 'alert.created.predator = ai/predator-detection');
  const temp = loadFixture('mqtt/readings').payload.find((r) => r.metric === 'TEMP');
  const ta = load('ws', 'alert.created.threshold.json').payload.alert;
  assert.deepEqual([ta.metricCode, ta.value], [temp.metric, temp.value], 'alert.created.threshold = mqtt/readings TEMP');
});
