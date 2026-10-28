import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { FIXTURES_DIR } from '../../contracts/lib/fixtures.mjs';
import { loadTestEnv } from './lib/env.mjs';
import { loadRefs, restore, sql } from './lib/sql.mjs';
import { startBackend, stopBackend, waitHealth } from './lib/backend.mjs';
import { login } from './lib/chain.mjs';
import { precheck } from './lib/precheck.mjs';
import { removeNewSnapshots, signHs256, sleep, snapshotFiles, waitFor } from './lib/util.mjs';

const env = loadTestEnv();
const pw = env.DEV_SEED_PASSWORD;
const snapsBefore = snapshotFiles();

async function withBackend(overrides, fn, { restoreDb = true, health = 200 } = {}) {
  if (restoreDb) restore(env);
  const b = startBackend(env, overrides);
  try {
    await waitHealth(b.port, health);
    return await fn(b, loadRefs(env));
  } finally {
    await stopBackend(b);
  }
}

const api = (port, token) => async (method, path, body) => {
  const r = await fetch(`http://localhost:${port}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const socketOf = (port, token) => new Promise((resolve, reject) => {
  const s = io(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
  const events = [];
  s.onAny((ev, p) => events.push({ ev, p }));
  s.once('connect', () => resolve({ s, events }));
  s.once('connect_error', (e) => reject(Object.assign(new Error('connect_error'), { data: e.data })));
});

const simClient = (id) => new Promise((resolve, reject) => {
  const c = mqtt.connect(env.MQTT_URL, { clientId: id, username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0 });
  c.once('connect', () => resolve(c));
  c.once('error', reject);
});

before(() => precheck(env));
after(() => removeNewSnapshots(snapsBefore));

test('DEVICE_OFFLINE tu nhip sp_DetectAnomalies (ANOMALY_SCHEDULER=on, toi da ~100 giay)', async () => {
  restore(env);
  // Cam bien ONLINE nhung LastSeenAt cu hon 5 phut -> nhip dau danh dau OFFLINE, trigger tao DEVICE_OFFLINE.
  sql(env, env.DB_NAME, "UPDATE dbo.Devices SET Status = 'ONLINE', LastSeenAt = DATEADD(MINUTE, -10, SYSUTCDATETIME()) WHERE Code = 'H1-F1-SENSOR';");
  await withBackend({ ANOMALY_SCHEDULER: 'on' }, async (b, refs) => {
    const { s, events } = await socketOf(b.port, await login(b.port, 'admin', pw));
    const t0 = Date.now();
    await waitFor(() => events.find((e) => e.ev === 'alert.created' && e.p.alert.alertType === 'DEVICE_OFFLINE' && e.p.alert.deviceId === refs('device', 'H1-F1-SENSOR')), 110_000, 'DEVICE_OFFLINE');
    console.log(`DEVICE_OFFLINE sau ${Math.round((Date.now() - t0) / 1000)} giay (ghi vao bao cao test)`);
    s.disconnect();
  }, { restoreDb: false });
});

test('CSDL loi khi dang gui so do (cau 6.6): du so do, khong ban ghi trung', async () => {
  await withBackend({}, async (b) => {
    const pub = await simClient('contract-test');
    const base = Date.now() - 120_000;
    const send = async (from, to) => {
      for (let i = from; i < to; i++) {
        const at = new Date(base + i * 1000).toISOString().slice(0, 19) + 'Z';
        await pub.publishAsync('swiftlet/devices/H1-F2-SENSOR/readings', JSON.stringify([{ device: 'H1-F2-SENSOR', metric: 'CO2', value: 600 + i, at }]), { qos: 1 });
        await sleep(100);
      }
    };
    await send(0, 20);
    sql(env, 'master', `ALTER DATABASE ${env.DB_NAME} SET OFFLINE WITH ROLLBACK IMMEDIATE;`);
    await send(20, 40);
    await sleep(5000);
    sql(env, 'master', `ALTER DATABASE ${env.DB_NAME} SET ONLINE;`);
    await send(40, 60);
    const count = () => Number(sql(env, env.DB_NAME, `SELECT COUNT(*) FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId WHERE d.Code = 'H1-F2-SENSOR' AND s.MetricCode = 'CO2' AND s.Value >= 600 AND s.Value < 660 AND s.RecordedAt >= CONVERT(DATETIME2(0), '${new Date(base).toISOString().slice(0, 19)}', 126)`)[0]);
    await waitFor(() => count() === 60, 90_000, 'du 60 so do sau khi CSDL ONLINE');
    for (const l of b.logs.join('').replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) if (/\[(Thu nhan|CSDL)\]/.test(l)) console.log(`CSDL OFFLINE log: ${l.slice(0, 220)}`);
    pub.end(true);
  });
});

test('cau hinh sai -> dung ma khac 0, neu ten bien, khong in gia tri', async () => {
  for (const [k, v] of [['ANOMALY_SCHEDULER', 'maybe'], ['DEMO_TOOLS', 'yes'], ['JWT_SECRET', 'ngan-qua-123']]) {
    const b = startBackend(env, { [k]: v });
    const code = await new Promise((r) => b.child.once('exit', r));
    await stopBackend(b);
    const out = b.logs.join('');
    assert.notEqual(code, 0, `${k}=${v} phai lam backend dung`);
    assert.match(out, new RegExp(k));
    assert.ok(!out.includes(v), `log chua gia tri sai cua ${k}`);
  }
});

// K7: CSDL khong ton tai -> SQL Server bao "Login failed" chung (S6), thong bao phai nhac DB_NAME.
test('DB_NAME khong ton tai -> dung sau 5 lan, thong bao nhac DB_NAME', async () => {
  const b = startBackend(env, { DB_NAME: 'SwiftletCare_Test_KhongTonTai' });
  const code = await Promise.race([new Promise((r) => b.child.once('exit', r)), sleep(120_000).then(() => 'qua han')]);
  await stopBackend(b);
  const out = b.logs.join('').replace(/\x1b\[[0-9;]*m/g, '');
  assert.equal(code, 1, `backend phai dung ma 1 (nhan ${code})`);
  assert.match(out, /Cau hinh CSDL sai \(lan 5\/5\)[^\n]*DB_NAME/);
  assert.ok(!out.includes(env.DB_PASSWORD), 'log chua mat khau');
});

test('endpoint admin (DEMO_TOOLS=true): POPULATION_DROP H2, alert.created, lan hai rong', async () => {
  await withBackend({ DEMO_TOOLS: 'true' }, async (b, refs) => {
    const token = await login(b.port, 'admin', pw);
    const { s, events } = await socketOf(b.port, token);
    const call = api(b.port, token);
    const r1 = await call('POST', '/api/admin/anomalies/detect', { nowUtc: '2026-10-12T13:30:00Z' });
    assert.equal(r1.status, 200);
    const drop = r1.body.newAlerts.find((a) => a.alertType === 'POPULATION_DROP');
    assert.ok(drop && drop.houseId === refs('house', 'H2'), 'phai co POPULATION_DROP cho H2');
    assert.equal(Date.parse(drop.createdAt), Date.parse('2026-10-12T13:30:00Z'), 'createdAt = nowUtc');
    await waitFor(() => events.find((e) => e.ev === 'alert.created' && e.p.alert.alertId === drop.alertId), 5000, 'alert.created');
    const r2 = await call('POST', '/api/admin/anomalies/detect', { nowUtc: '2026-10-12T13:30:00Z' });
    assert.deepEqual(r2.body, { newAlerts: [] });
    s.disconnect();
  });
});

// T20-1: phien khac giu khoa Devices/Alerts -> nhip dau (~60 s sau onModuleInit) bi treo; admin cho 10 s roi 503.
// Thuc te nhip bi cat sau 15 s boi requestTimeout mac dinh cua mssql (T23-1), nen admin phai goi trong 5 s dau.
test('nhip dang chay -> admin 503 RETRY_LATER sau 10 giay; nhip loi thi nha khoa', async () => {
  restore(env);
  const b = startBackend(env, { ANOMALY_SCHEDULER: 'on', DEMO_TOOLS: 'true' });
  // Do moc "Lang nghe" truc tiep (doc gio trong log Nest lech ~1 gio o lan chay 6 -> treo).
  let listenAt = 0;
  b.child.stdout.on('data', (d) => { if (!listenAt && String(d).includes('Lang nghe')) listenAt = Date.now(); });
  try {
    await waitHealth(b.port, 200);
    assert.ok(listenAt, 'khong thay log Lang nghe');
    const locker = spawn('sqlcmd', ['-S', `${env.DB_SERVER},${env.DB_PORT}`, '-U', env.DB_USER, '-d', env.DB_NAME, '-b', '-C', '-Q',
      "BEGIN TRAN; SELECT COUNT(*) FROM dbo.Devices WITH (TABLOCKX, HOLDLOCK); SELECT COUNT(*) FROM dbo.Alerts WITH (TABLOCKX, HOLDLOCK); WAITFOR DELAY '00:01:50'; ROLLBACK;"],
      { env: { ...process.env, SQLCMDPASSWORD: env.DB_PASSWORD }, stdio: 'ignore' });
    try {
      const token = await login(b.port, 'admin', pw);
      await sleep(Math.min(70_000, Math.max(0, listenAt + 62_000 - Date.now()))); // nhip dau vua bat dau va dang cho khoa
      const t0 = Date.now();
      const r = await api(b.port, token)('POST', '/api/admin/anomalies/detect', { nowUtc: '2026-10-12T13:30:00Z' });
      const waited = Date.now() - t0;
      console.log(`admin khi nhip dang chay: ${r.status} ${r.body?.error?.code} sau ${waited} ms`);
      assert.equal(r.status, 503);
      assert.equal(r.body.error.code, 'RETRY_LATER');
      assert.ok(waited >= 9_500 && waited < 12_000, `cho ${waited} ms`);
      await waitFor(() => /sp_DetectAnomalies loi/.test(b.logs.join('')), 40_000, 'log nhip loi');
    } finally {
      locker.kill();
    }
  } finally {
    await stopBackend(b);
  }
});

test('gui cung su kien thien dich hai lan song song (spec 5.9): mot canh bao, khong file tam', async () => {
  await withBackend({}, async (b) => {
    const at = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().slice(0, 19) + 'Z';
    const send = () => {
      const fd = new FormData();
      fd.append('metadata', JSON.stringify({ camera: 'H1-F0-CAMERA', class: 'owl', confidence: 0.9, at }));
      fd.append('image', new Blob([readFileSync(join(FIXTURES_DIR, 'ai', 'snake.jpg'))], { type: 'image/jpeg' }), 'snake.jpg');
      return fetch(`http://localhost:${b.port}/api/ai/predator-detections`, { method: 'POST', headers: { 'X-Service-Key': env.AI_SERVICE_KEY }, body: fd }).then((r) => r.json());
    };
    const rs = await Promise.all([send(), send()]);
    assert.deepEqual(rs.map((r) => r.created).sort(), [false, true]);
    assert.ok(rs.some((r) => r.skipReason === 'COOLDOWN'));
    assert.deepEqual(existsSync('storage/tmp') ? readdirSync('storage/tmp') : [], []);
  });
});

test('Socket.IO: token sai UNAUTHENTICATED, cach ly chu nha, bi khoa thi bi ngat, ADMIN nhan nha moi tao', async () => {
  await withBackend({}, async (b, refs) => {
    await assert.rejects(socketOf(b.port, 'sai'), (e) => e.data?.code === 'UNAUTHENTICATED');
    // K16: token het han sau 4 giay -> server ngat dung han.
    const now = Math.floor(Date.now() / 1000);
    const short = await socketOf(b.port, signHs256(env.JWT_SECRET, { sub: refs('user', 'owner2'), role: 'OWNER', iat: now, exp: now + 4 }));
    const t0 = Date.now();
    await new Promise((r) => short.s.once('disconnect', r));
    const lived = Date.now() - t0;
    console.log(`token het han: bi ngat sau ${lived} ms (con ~${(now + 4) * 1000 - t0} ms luc ket noi)`);
    assert.ok(Date.now() >= (now + 4) * 1000 - 500 && Date.now() < (now + 4) * 1000 + 2000, 'ngat dung han token');
    const admin = await login(b.port, 'admin', pw);
    const a = await socketOf(b.port, admin);
    const o2 = await socketOf(b.port, await login(b.port, 'owner2', pw));
    const o1 = await socketOf(b.port, await login(b.port, 'owner1', pw));
    // Cach ly: so do H1 -> owner2 khong nhan.
    const pub = await simClient('contract-test');
    const at = new Date().toISOString().slice(0, 19) + 'Z';
    await pub.publishAsync('swiftlet/devices/H1-F1-SENSOR/readings', JSON.stringify([{ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28, at }]), { qos: 1 });
    await waitFor(() => o1.events.find((e) => e.ev === 'readings.new'), 5000, 'owner1 nhan readings.new');
    await sleep(1000);
    assert.equal(o2.events.filter((e) => e.p?.houseId === refs('house', 'H1')).length, 0, 'owner2 khong duoc nhan su kien H1');
    // ADMIN ket noi TRUOC khi nha moi duoc tao van nhan su kien cua nha do.
    const call = api(b.port, admin);
    const h = await call('POST', '/api/houses', { name: 'Nha test socket', ownerId: refs('user', 'owner2') });
    assert.equal(h.status, 201);
    const z = await call('POST', `/api/houses/${h.body.houseId}/zones`, { name: 'F9', floorNo: 9 });
    const d = await call('POST', `/api/zones/${z.body.zoneId}/devices`, { code: 'HT-F9-FAN', name: 'Quat test', deviceType: 'FAN' });
    await call('POST', `/api/devices/${d.body.deviceId}/control`, { isOn: true, level: 50, mode: 'MANUAL' });
    await waitFor(() => a.events.find((e) => e.ev === 'device.state' && e.p.houseId === h.body.houseId), 5000, 'ADMIN nhan device.state nha moi');
    // Su kien trong luc nha ngung dung khong duoc phat bu khi dung lai.
    await call('PATCH', `/api/houses/${h.body.houseId}`, { isActive: false });
    await call('POST', `/api/devices/${d.body.deviceId}/control`, { isOn: false, mode: 'MANUAL' });
    await call('PATCH', `/api/houses/${h.body.houseId}`, { isActive: true });
    await sleep(1000);
    assert.equal(a.events.filter((e) => e.ev === 'device.state' && e.p.deviceId === d.body.deviceId && e.p.isOn === false).length, 0, 'khong phat bu');
    // Khoa owner1 -> socket cua owner1 bi ngat.
    const disconnected = new Promise((r) => o1.s.once('disconnect', r));
    await call('PATCH', `/api/users/${refs('user', 'owner1')}`, { isActive: false });
    // Khong de sleep().then(assert.fail) treo sau khi da ngat (rejection khong ai bat).
    assert.ok(await Promise.race([disconnected.then(() => true), sleep(5000).then(() => false)]), 'owner1 khong bi ngat');
    for (const x of [a, o2]) x.s.disconnect();
    pub.end(true);
  });
});

test('Socket.IO: CSDL chua san sang -> connect_error.data.code = RETRY_LATER', async () => {
  const refs = loadRefs(env);
  await withBackend({ DB_PORT: '1' }, async (b) => {
    const token = signHs256(env.JWT_SECRET, { sub: refs('user', 'owner1'), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 });
    await assert.rejects(socketOf(b.port, token), (e) => e.data?.code === 'RETRY_LATER');
  }, { restoreDb: false, health: 503 });
});

test('LAST_ADMIN: hai ADMIN ha nhau dong thoi -> mot 200, mot 409, con it nhat mot ADMIN; trung username/email -> 409 DUPLICATE', async () => {
  await withBackend({}, async (b, refs) => {
    const admin = await login(b.port, 'admin', pw);
    const c = await api(b.port, admin)('POST', '/api/users', { username: 'admin2', password: 'mat-khau-admin2', fullName: 'Admin 2', email: 'admin2@swiftletcare.local', role: 'ADMIN' });
    assert.equal(c.status, 201);
    const admin2 = await login(b.port, 'admin2', 'mat-khau-admin2');
    const [r1, r2] = await Promise.all([
      api(b.port, admin)('PATCH', `/api/users/${c.body.userId}`, { role: 'OWNER' }),
      api(b.port, admin2)('PATCH', `/api/users/${refs('user', 'admin')}`, { role: 'OWNER' }),
    ]);
    console.log(`LAST_ADMIN dong thoi: ${r1.status}, ${r2.status}`);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
    assert.equal([r1, r2].find((r) => r.status === 409).body.error.code, 'LAST_ADMIN');
    assert.ok(Number(sql(env, env.DB_NAME, "SELECT COUNT(*) FROM dbo.Users WHERE Role = 'ADMIN' AND IsActive = 1")[0]) >= 1);
    // T10-3: trung username, trung email -> 409 DUPLICATE (tai khoan con ADMIN goi).
    const stillAdmin = r1.status === 200 ? admin : admin2;
    const dupUser = await api(b.port, stillAdmin)('POST', '/api/users', { username: 'admin2', password: 'mat-khau-khac-1', fullName: 'X', email: 'khac@swiftletcare.local', role: 'OWNER' });
    const dupMail = await api(b.port, stillAdmin)('POST', '/api/users', { username: 'nguoi-moi', password: 'mat-khau-khac-1', fullName: 'X', email: 'admin2@swiftletcare.local', role: 'OWNER' });
    for (const r of [dupUser, dupMail]) {
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'DUPLICATE');
    }
  });
});
