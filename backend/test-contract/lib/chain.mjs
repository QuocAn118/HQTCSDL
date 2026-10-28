import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { FIXTURES_DIR, baseNow, expand, loadChain, match } from '../../../contracts/lib/fixtures.mjs';
import { sql } from './sql.mjs';
import { signHs256, sleep, waitFor } from './util.mjs';

export const transcript = { bodies: [], logs: [] };

export async function login(port, username, password) {
  const r = await fetch(`http://localhost:${port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(r.status, 200, `dang nhap ${username} that bai (${r.status})`);
  return (await r.json()).accessToken;
}

// So do mong luu sau moi fixture MQTT gui len (kiem tac dung phu, khong co "response").
const MQTT_EXPECT = {
  'mqtt/readings': [['H1-F1-SENSOR', 4]],
  'mqtt/readings.invalid-missing-z': [['H1-F1-SENSOR', 1]],
  'mqtt/readings.invalid-offset': [['H1-F1-SENSOR', 1]],
  'mqtt/readings.invalid-device-mismatch': [['H1-F1-SENSOR', 1], ['H1-F2-SENSOR', 0]],
  'mqtt/readings.invalid-not-array': [['H1-F1-SENSOR', 0]],
};

const countAt = (env, code, nowIso) => Number(sql(env, env.DB_NAME,
  `SELECT COUNT(*) FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId WHERE d.Code = '${code}' AND s.RecordedAt = CONVERT(DATETIME2(0), '${nowIso.slice(0, 19)}', 126)`)[0]);

const mqttConnect = (env, clientId) => new Promise((resolve, reject) => {
  const c = mqtt.connect(env.MQTT_URL, { clientId, username: env.SIM_MQTT_USERNAME, password: env.SIM_MQTT_PASSWORD, reconnectPeriod: 0 });
  c.once('connect', () => resolve(c));
  c.once('error', reject);
});

/**
 * Chay mot chuoi fixture tren backend dang chay. opts: { env, port, refs, localTokens?: boolean }
 * Ca chuoi dung mot "now" (bo sung hop dong B6).
 */
export async function runChain(name, opts) {
  const { env, port, refs } = opts;
  const chain = loadChain(name);
  const text = chain.map((c) => JSON.stringify(c.fixture)).join('\n');
  const users = [...new Set([...text.matchAll(/\{\{token:(\w+)\}\}/g)].map((m) => m[1]))];
  const tokens = new Map();
  for (const u of users) {
    tokens.set(u, opts.localTokens
      ? signHs256(env.JWT_SECRET, { sub: refs('user', u), role: 'X', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })
      : await login(port, u, env.DEV_SEED_PASSWORD));
  }
  const ctx = { now: baseNow(), ref: refs, token: (u) => tokens.get(u), serviceKey: env.AI_SERVICE_KEY, devPassword: env.DEV_SEED_PASSWORD };
  const nowIso = ctx.now.toISOString();

  // Nghe truoc roi moi gui tac nhan (spec backend 7.2).
  const events = [];
  const commands = [];
  const closers = [];
  if (chain.some((c) => c.name.startsWith('ws/'))) {
    const socket = io(`http://localhost:${port}`, { auth: { token: await login(port, 'admin', env.DEV_SEED_PASSWORD) }, transports: ['websocket'], reconnection: false });
    socket.onAny((ev, payload) => { events.push({ ev, payload, t: Date.now() }); transcript.bodies.push(payload); });
    await waitFor(() => socket.connected, 5000, 'socket ket noi');
    closers.push(() => socket.disconnect());
  }
  let pub = null;
  if (chain.some((c) => c.name.startsWith('mqtt/') && !c.fixture.topic.endsWith('/command'))) {
    pub = await mqttConnect(env, 'contract-test');
    closers.push(() => pub.end(true));
  }
  if (chain.some((c) => c.name.startsWith('mqtt/') && c.fixture.topic.endsWith('/command'))) {
    const sub = await mqttConnect(env, 'contract-test-sub');
    sub.on('message', (topic, payload, packet) => { if (!packet.retain) commands.push({ topic, payload: JSON.parse(String(payload)), t: Date.now() }); });
    await sub.subscribeAsync('swiftlet/devices/+/command', { qos: 1 });
    closers.push(() => sub.end(true));
  }

  try {
    let since = Date.now();
    for (const { name: step, fixture } of chain) {
      const f = expand(fixture, ctx);
      const folder = step.split('/')[0];
      if (folder === 'ws') {
        await expectOne(step, () => events.filter((e) => e.ev === f.event && e.t >= since), (e) => match(f.payload, e.payload));
      } else if (folder === 'mqtt' && f.topic.endsWith('/command')) {
        await expectOne(step, () => commands.filter((c) => c.topic === f.topic && c.t >= since), (c) => match(f.payload, c.payload));
      } else if (folder === 'mqtt') {
        since = Date.now();
        await pub.publishAsync(f.topic, JSON.stringify(f.payload), { qos: 1 });
        for (const [code, n] of MQTT_EXPECT[step] ?? []) {
          if (n === 0) { await sleep(3000); assert.equal(countAt(env, code, nowIso), 0, `${step}: ${code} khong duoc luu`); }
          else await waitFor(() => countAt(env, code, nowIso) === n, 5000, `${step}: ${code} luu ${n} so do`);
        }
      } else {
        since = Date.now();
        await http(step, f, port);
      }
    }
  } finally {
    for (const c of closers) c();
  }
}

async function expectOne(step, candidates, diff) {
  try {
    await waitFor(() => candidates().find((x) => diff(x).length === 0), 5000, step);
  } catch {
    const near = candidates().map(diff);
    assert.fail(`${step}: khong co su kien/tin khop trong 5 giay. ${near.length ? `Gan nhat: ${near[0].join('; ')}` : 'Khong nhan duoc gi.'}`);
  }
}

async function http(step, f, port) {
  const headers = { ...(f.headers ?? {}) };
  let body;
  if (f.body && typeof f.body === 'object' && !Array.isArray(f.body) && Object.values(f.body).some((v) => typeof v === 'string' && v.startsWith('@'))) {
    body = new FormData();
    for (const [k, v] of Object.entries(f.body)) {
      if (typeof v === 'string' && v.startsWith('@')) {
        const file = v.slice(1);
        body.append(k, new Blob([readFileSync(join(FIXTURES_DIR, step.split('/')[0], file))], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }), file);
      } else {
        body.append(k, typeof v === 'string' ? v : JSON.stringify(v)); // metadata gui dang chuoi JSON (B5)
      }
    }
  } else if (f.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(f.body);
  }
  const r = await fetch(`http://localhost:${port}${f.path}`, { method: f.method, headers, body });
  const raw = await r.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = raw; }
  transcript.bodies.push(json);
  assert.equal(r.status, f.status, `${step}: HTTP ${r.status} (mong ${f.status}): ${raw.slice(0, 300)}`);
  assert.deepEqual(match(f.response, json), [], `${step}: phan hoi lech`);
}
