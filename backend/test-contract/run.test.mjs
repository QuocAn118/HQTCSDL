import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { FIXTURES_DIR, loadChain, loadFixture } from '../../contracts/lib/fixtures.mjs';
import { loadTestEnv } from './lib/env.mjs';
import { loadRefs, restore } from './lib/sql.mjs';
import { precheck } from './lib/precheck.mjs';
import { startBackend, stopBackend, waitHealth } from './lib/backend.mjs';
import { runChain, transcript } from './lib/chain.mjs';
import { removeNewSnapshots, snapshotFiles } from './lib/util.mjs';

const env = loadTestEnv();
const snapsBefore = snapshotFiles();

// Fixture duoi ranh gioi cat: bo qua TUONG MINH, in trong bao cao. Lam muc 9/10 thi xoa khoi danh sach (spec 7.2).
const SKIP_CUT = ['rest/harvests-post.cut', 'rest/report-env-vs-yield.cut'];
// Chuoi chay voi backend tro CSDL toi cong khong ai nghe (PR hop dong Task 3).
const DB_DOWN = ['rest/health.invalid-db-down', 'rest/houses-list.invalid-db-not-ready'];

// Tong > 15 phut tren may nhom (khoi dong backend ~24 s/chuoi): gom cac chuoi CHI DOC (khong ghi CSDL, khong after)
// vao mot lan phuc hoi + mot backend (spec backend 7.2 "chi gom khi chac chan"; plan Task 22 Step 6).
const READ_ONLY = ['rest/health', 'rest/house.invalid-not-owner', 'rest/auth-login', 'rest/auth-login.invalid-credentials', 'rest/alerts-list.page', 'ai/ai.invalid-service-key'];

const all = ['rest', 'ws', 'mqtt', 'ai'].flatMap((d) => readdirSync(join(FIXTURES_DIR, d)).filter((f) => f.endsWith('.json')).map((f) => `${d}/${f.slice(0, -5)}`));
const referenced = new Set(all.map((n) => loadFixture(n).after).filter(Boolean));
const leaves = all.filter((n) => !referenced.has(n) && !SKIP_CUT.includes(n)).sort();
const ran = new Set();
const restoreTimes = [];

before(() => precheck(env));

test(`nhom chi doc (mot lan phuc hoi): ${READ_ONLY.join(', ')}`, async (t) => {
  restoreTimes.push(restore(env));
  const refs = loadRefs(env);
  const b = startBackend(env);
  try {
    await waitHealth(b.port, 200);
    for (const name of READ_ONLY)
      await t.test(`chuoi ${name}`, async () => {
        await runChain(name, { env, port: b.port, refs });
        for (const step of loadChain(name)) ran.add(step.name);
      });
  } finally {
    await stopBackend(b);
    transcript.logs.push(...b.logs);
  }
});

for (const name of leaves.filter((n) => !READ_ONLY.includes(n))) {
  test(`chuoi ${name}`, async () => {
    const dbDown = DB_DOWN.includes(name);
    if (!dbDown) restoreTimes.push(restore(env));
    const refs = loadRefs(env);
    const b = startBackend(env, dbDown ? { DB_PORT: '1' } : {});
    try {
      await waitHealth(b.port, dbDown ? 503 : 200);
      await runChain(name, { env, port: b.port, refs, localTokens: dbDown });
      for (const step of loadChain(name)) ran.add(step.name);
    } finally {
      await stopBackend(b);
      transcript.logs.push(...b.logs);
    }
  });
}

test('do phu fixture: moi file da chay, tru danh sach bo qua tuong minh', () => {
  console.log(`Bo qua (duoi ranh gioi cat): ${SKIP_CUT.join(', ') || '(khong)'}`);
  console.log(`Thoi gian RESTORE (ms): ${restoreTimes.join(', ')}`);
  assert.deepEqual(all.filter((n) => !ran.has(n) && !SKIP_CUT.includes(n)), []);
});

test('an toan du lieu tra ra (spec backend 7.2)', () => {
  const bodies = JSON.stringify(transcript.bodies);
  assert.doesNotMatch(bodies, /passwordHash|snapshotPath/i);
  const pascal = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (/^[A-Z]/.test(k)) pascal.push(`${path}.${k}`); walk(x, `${path}.${k}`); }
  };
  walk(transcript.bodies, '$');
  assert.deepEqual(pascal, [], 'khoa PascalCase lot ra');
  for (const m of bodies.matchAll(/"message":"([^"]*)"/g)) assert.doesNotMatch(m[1], /SQL|constraint|statement|[A-Z]:\\\\|\/home\//i, `message lo chi tiet: ${m[1]}`);
  const logs = transcript.logs.join('');
  for (const k of ['AI_SERVICE_KEY', 'JWT_SECRET', 'DB_PASSWORD', 'MQTT_PASSWORD', 'SIM_MQTT_PASSWORD', 'DEV_SEED_PASSWORD']) {
    if (env[k]?.length >= 6) assert.ok(!logs.includes(env[k]), `log chua gia tri ${k}`);
  }
  assert.ok(!logs.includes('Bearer '), 'log chua token');
});

after(() => {
  console.log(`Da chay ${ran.size}/${all.length} fixture`);
  removeNewSnapshots(snapsBefore);
});
