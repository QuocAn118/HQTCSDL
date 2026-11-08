// Do do tre end-to-end (spec backend 7.3; lech so voi spec ghi o results/latency.md):
// script tu publish so do qua MQTT -> backend gom lo -> sp_IngestReadings -> readings.new qua Socket.IO,
// do tu luc publish den luc nhan su kien, cung mot tien trinh (performance.now). Chi chay tren SwiftletCare_Dev;
// simulator (bat truoc), backend, Mosquitto, SQL Server cung mot may.
// Chay tu backend/: npm run measure:latency -- [so mau=200] [tai khoan=owner1]
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { readEnvFile } from '../test-contract/lib/env.mjs';
import { sleep } from '../test-contract/lib/util.mjs';
import { createTracker, summarize, toCsv } from './latency-lib.mjs';

const env = readEnvFile('.env');
if (env.DB_NAME !== 'SwiftletCare_Dev') { console.error('Tu choi: chi do tren SwiftletCare_Dev (DB_NAME trong .env)'); process.exit(2); }
for (const k of ['PORT', 'MQTT_URL', 'LATENCY_MQTT_USERNAME', 'LATENCY_MQTT_PASSWORD']) if (!env[k]) { console.error(`Thieu ${k} trong .env`); process.exit(2); }
const { DEV_SEED_PASSWORD } = readEnvFile('.env.test');
const BASE = `http://localhost:${env.PORT}`;
const TARGET_MS = 2000; // chi tieu dashboard <= 2 giay (hop dong 2.3)
const TIMEOUT_MS = 10_000;
const SAMPLES = Number(process.argv[2] ?? 200);
const USER = process.argv[3] ?? 'owner1';
const fail = (msg) => { console.error(msg); process.exit(3); };

const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: DEV_SEED_PASSWORD }) });
if (!res.ok) fail(`Dang nhap ${USER} that bai: HTTP ${res.status}`);
const { accessToken: token } = await res.json();

const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
await new Promise((ok, ko) => { socket.once('connect', ok); socket.once('connect_error', (e) => ko(new Error(`Socket.IO: ${e.message}`))); });

const tracker = createTracker(TIMEOUT_MS);
const lastTemp = new Map(); // cam bien -> TEMP moi nhat cua simulator, de mau gui gan gia tri that (khong mo canh bao)
const simRows = [];
socket.on('readings.new', (e) => {
  const t = performance.now();
  const wall = Date.now();
  for (const r of e.readings) {
    if (tracker.received(r, t)) continue;
    // So do cua simulator: nhan - at (at simulator gan, lam tron giay) -> chi de doi chieu, khong phai so chinh.
    simRows.push({ kind: 'sim', zone: r.deviceCode, ms: wall - Date.parse(r.at), status: 'ok' });
    if (r.metric === 'TEMP') lastTemp.set(r.deviceCode, Number(r.value));
  }
});

console.log('Cho simulator gui TEMP (toi da 30 giay)...');
for (const end = Date.now() + 30_000; !lastTemp.size && Date.now() < end; ) await sleep(200);
if (!lastTemp.size) fail(`Khong thay readings.new cua ${USER} trong 30 giay: simulator/backend da chay chua?`);

const pub = mqtt.connect(env.MQTT_URL, { clientId: 'latency-probe', username: env.LATENCY_MQTT_USERNAME, password: env.LATENCY_MQTT_PASSWORD, reconnectPeriod: 0 });
await new Promise((ok, ko) => { pub.once('connect', ok); pub.once('error', (e) => ko(new Error(`MQTT: ${e.message}`))); });

const sensors = [...lastTemp.keys()].sort();
console.log(`Do ${SAMPLES} mau tren ${sensors.join(', ')}...`);
const startedAt = new Date().toISOString();
for (let i = 0; i < SAMPLES; ) {
  const device = sensors[i % sensors.length];
  const at = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
  const value = Math.round((lastTemp.get(device) + 0.01) * 100) / 100; // DECIMAL(9,2)
  const t0 = performance.now();
  if (!tracker.sent({ device, metric: 'TEMP', value, at }, t0)) { await sleep(300); continue; } // giay nay da co so do khac
  await pub.publishAsync(`swiftlet/devices/${device}/readings`, JSON.stringify([{ device, metric: 'TEMP', value, at }]), { qos: 1 });
  i++;
  while (tracker.pending() && performance.now() - t0 <= TIMEOUT_MS) await sleep(20);
  tracker.expire(performance.now());
  await sleep(200 + Math.random() * 600); // lech pha voi nhip gom lo 1 giay cua backend
}
pub.end(true);
socket.disconnect();

const count = (s) => tracker.rows.filter((r) => r.status === s).length;
const okMs = tracker.rows.filter((r) => r.status === 'ok').map((r) => r.ms);
const s = summarize(okMs, TARGET_MS, count('mat'));
const sim = summarize(simRows.map((r) => r.ms), TARGET_MS);
const stamp = startedAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const machine = `${os.cpus()[0]?.model} x${os.cpus().length}, RAM ${Math.round(os.totalmem() / 2 ** 30)} GB (trong ${Math.round(os.freemem() / 2 ** 30)} GB luc ket thuc), Windows ${os.release()}, Node ${process.version}`;
const summary = [
  `# Bat dau ${startedAt}, ket thuc ${new Date().toISOString()}, tai khoan ${USER}`,
  `# May: ${machine}`,
  `# Mau tu gui (publish -> readings.new): gui=${tracker.rows.length} ok=${s.n} mat=${s.lost} trung=${count('trung')} p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max} vuot ${TARGET_MS} ms: ${(s.overTarget * 100).toFixed(1)}%`,
  `# So do simulator (nhan - at, gom ca phan lam tron giay cua at): n=${sim.n} p50=${sim.p50} p95=${sim.p95} p99=${sim.p99} max=${sim.max}`,
].join('\n');
mkdirSync('results', { recursive: true });
writeFileSync(`results/latency-${stamp}.csv`, `${summary}\n${toCsv([...tracker.rows, ...simRows])}`);
console.log(`${summary}\n-> results/latency-${stamp}.csv`);
process.exit(0);
