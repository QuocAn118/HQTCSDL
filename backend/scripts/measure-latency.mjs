// Do do tre end-to-end (spec backend 7.3; lech so voi spec ghi o results/latency.md).
// Script tu publish so do qua MQTT -> backend gom lo -> sp_IngestReadings -> su kien Socket.IO ve chinh script,
// do bang performance.now() trong cung tien trinh. Chi chay tren SwiftletCare_Dev; simulator (bat truoc),
// backend, Mosquitto, SQL Server cung mot may. Chay tu backend/:
//   npm run measure:latency -- readings [so mau=200]        tuan tu, TEMP, cho tung mau -> readings.new
//   npm run measure:latency -- rate [mau/giay=5] [giay=60]  gui deu, khong cho, moi cap cam bien+chi so -> readings.new
//   npm run measure:latency -- alerts [so lan=30]           TEMP vuot Max -> alert.created, roi dong canh bao
// LATENCY_NOTE (bien moi truong, tuy chon) duoc ghi vao dau CSV, vd "ANOMALY_SCHEDULER=off".
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { readEnvFile } from '../test-contract/lib/env.mjs';
import { sleep } from '../test-contract/lib/util.mjs';
import { alertStatus, alertValues, createTracker, isProbeAlert, summarize, toCsv } from './latency-lib.mjs';

const env = readEnvFile('.env');
if (env.DB_NAME !== 'SwiftletCare_Dev') { console.error('Tu choi: chi do tren SwiftletCare_Dev (DB_NAME trong .env)'); process.exit(2); }
for (const k of ['PORT', 'MQTT_URL', 'LATENCY_MQTT_USERNAME', 'LATENCY_MQTT_PASSWORD']) if (!env[k]) { console.error(`Thieu ${k} trong .env`); process.exit(2); }
const { DEV_SEED_PASSWORD } = readEnvFile('.env.test');
const BASE = `http://localhost:${env.PORT}`;
const USER = 'owner1';
const TARGET_MS = 2000; // Project.md: cam bien len bang dieu khien trong vong 2 giay
const TIMEOUT_MS = 10_000;
const [mode = 'readings', a1, a2] = process.argv.slice(2);
if (!['readings', 'rate', 'alerts'].includes(mode)) { console.error('Che do: readings | rate | alerts'); process.exit(2); }
const fail = (msg) => { console.error(msg); process.exit(3); };
const isoSec = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: DEV_SEED_PASSWORD }) });
if (!res.ok) fail(`Dang nhap ${USER} that bai: HTTP ${res.status}`);
const { accessToken: token } = await res.json();
const get = async (path) => { const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) fail(`GET ${path}: HTTP ${r.status}`); return r.json(); };

const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
await new Promise((ok, ko) => { socket.once('connect', ok); socket.once('connect_error', (e) => ko(new Error(`Socket.IO: ${e.message}`))); });

const tracker = createTracker(TIMEOUT_MS);
const last = new Map(); // "cam bien|chi so" -> gia tri moi nhat cua simulator, de mau gui gan gia tri that
const zoneOf = new Map(); // cam bien -> zoneId
const simRows = [];
socket.on('readings.new', (e) => {
  const t = performance.now();
  const wall = Date.now();
  for (const r of e.readings) {
    if (tracker.received(r, t)) continue;
    // So do khong phai mau cua script (simulator, hoac so do dong canh bao): nhan - at, at lam tron giay -> chi doi chieu.
    simRows.push({ kind: 'sim', zone: r.deviceCode, at: r.at, ms: wall - Date.parse(r.at), status: 'ok' });
    last.set(`${r.deviceCode}|${r.metric}`, Number(r.value));
    zoneOf.set(r.deviceCode, r.zoneId);
  }
});

console.log('Cho simulator gui du 4 chi so (toi da 30 giay)...');
for (const end = Date.now() + 30_000; Date.now() < end; await sleep(200)) {
  const temps = [...last.keys()].filter((k) => k.endsWith('|TEMP')).length;
  if (temps && last.size >= temps * 4) break;
}
if (!last.size) fail(`Khong thay readings.new cua ${USER} trong 30 giay: simulator/backend da chay chua?`);

const pub = mqtt.connect(env.MQTT_URL, { clientId: 'latency-probe', username: env.LATENCY_MQTT_USERNAME, password: env.LATENCY_MQTT_PASSWORD, reconnectPeriod: 0 });
await new Promise((ok, ko) => { pub.once('connect', ok); pub.once('error', (e) => ko(new Error(`MQTT: ${e.message}`))); });
const publish = (device, metric, value, at) => pub.publishAsync(`swiftlet/devices/${device}/readings`, JSON.stringify([{ device, metric, value, at }]), { qos: 1 });

const sensors = [...zoneOf.keys()].sort();
const startedAt = new Date().toISOString();
const rows = [];
let header;

if (mode === 'readings') {
  const n = Number(a1 ?? 200);
  console.log(`readings: ${n} mau tuan tu (TEMP) tren ${sensors.join(', ')}...`);
  for (let i = 0; i < n; ) {
    const device = sensors[i % sensors.length];
    const at = isoSec(Date.now());
    const value = Math.round((last.get(`${device}|TEMP`) + 0.01) * 100) / 100;
    const t0 = performance.now();
    if (!tracker.sent({ device, metric: 'TEMP', value, at }, t0)) { await sleep(300); continue; } // giay nay da co so do khac
    await publish(device, 'TEMP', value, at);
    i++;
    while (tracker.pending() && performance.now() - t0 <= TIMEOUT_MS) await sleep(20);
    tracker.expire(performance.now());
    await sleep(200 + Math.random() * 600); // lech pha voi nhip gom lo 1 giay cua backend
  }
  header = `readings tuan tu, ${n} mau`;
} else if (mode === 'rate') {
  const perSec = Number(a1 ?? 5);
  const seconds = Number(a2 ?? 60);
  const pairs = [...last.keys()].sort(); // moi cap lap lai sau pairs.length/perSec giay -> khong tu trung giay
  console.log(`rate: ${perSec} mau/giay trong ${seconds} giay, ${pairs.length} cap cam bien+chi so...`);
  const t0 = performance.now();
  let skipped = 0;
  for (let i = 0; i < perSec * seconds; i++) {
    const wait = t0 + (i * 1000) / perSec - performance.now();
    if (wait > 0) await sleep(wait);
    const [device, metric] = pairs[i % pairs.length].split('|');
    const at = isoSec(Date.now());
    const value = Math.round((last.get(`${device}|${metric}`) + 0.01) * 100) / 100;
    if (!tracker.sent({ device, metric, value, at }, performance.now())) { skipped++; continue; }
    publish(device, metric, value, at).catch((e) => console.error(`publish loi: ${e.message}`)); // khong cho PUBACK: giu tan suat
    tracker.expire(performance.now());
  }
  const sendSec = (performance.now() - t0) / 1000;
  for (const end = performance.now() + TIMEOUT_MS + 100; tracker.pending() && performance.now() < end; ) await sleep(50);
  tracker.expire(Infinity);
  header = `rate ${perSec} mau/giay x ${seconds} giay: gui ${tracker.rows.length} mau trong ${sendSec.toFixed(1)} giay, bo qua ${skipped} vi trung giay`;
} else {
  const n = Number(a1 ?? 30);
  const zones = [];
  for (const device of sensors) {
    const zoneId = zoneOf.get(device);
    const v = alertValues((await get(`/api/zones/${zoneId}/thresholds`)).find((t) => t.metricCode === 'TEMP'));
    if (v) zones.push({ device, zoneId, ...v });
  }
  if (!zones.length) fail('Khong khu vuc nao co nguong TEMP Max');
  console.log(`alerts: ${n} lan tren ${zones.map((z) => `${z.device} (mo ${z.high}, dong ${z.close})`).join(', ')}...`);
  const once = (event, match) => {
    let h;
    const p = new Promise((resolve) => {
      h = (e) => { if (match(e)) resolve(e); };
      socket.on(event, h);
      setTimeout(() => resolve(null), TIMEOUT_MS);
    });
    return p.finally(() => socket.off(event, h));
  };
  for (let i = 0; i < n; ) {
    const z = zones[i % zones.length];
    const probe = { zoneId: z.zoneId, metric: 'TEMP', value: z.high };
    const at = isoSec(Date.now());
    const t0 = performance.now();
    // So do mo canh bao cung vao tracker: bi CSDL bo vi trung giay voi simulator thi ghi "trung", khong phai "mat".
    if (!tracker.sent({ device: z.device, metric: 'TEMP', value: z.high, at }, t0)) { await sleep(300); continue; }
    let alert = null;
    const onCreated = (e) => { if (!alert && isProbeAlert(e.alert, probe)) alert = { ms: Math.round(performance.now() - t0), alertId: e.alert.alertId }; };
    socket.on('alert.created', onCreated);
    await publish(z.device, 'TEMP', z.high, at);
    i++;
    const readingRow = () => tracker.rows.find((r) => r.zone === z.device && r.at === at);
    while (!alert && readingRow()?.status !== 'trung' && performance.now() - t0 <= TIMEOUT_MS) await sleep(20);
    socket.off('alert.created', onCreated);
    tracker.expire(performance.now());
    const status = alertStatus(Boolean(alert), readingRow());
    rows.push({ kind: 'alert', zone: z.device, at, ms: alert ? alert.ms : '', status });
    if (alert) {
      // Dong: so do moi hon (giay sau) trong vung dong, cho alert.updated RESOLVED truoc lan ke tiep.
      const resolved = once('alert.updated', (u) => u.alertId === alert.alertId && u.status === 'RESOLVED');
      await sleep(1100);
      await publish(z.device, 'TEMP', z.close, isoSec(Date.now()));
      if (!(await resolved)) console.warn(`Canh bao ${alert.alertId} chua RESOLVED sau ${TIMEOUT_MS} ms`);
    } else console.warn(`Lan ${i} (${z.device}, ${at}): ${status}`);
    await sleep(Math.random() * 1000); // ca khi mat: lech pha voi nhip gom lo va nhip 10 giay cua simulator
  }
  header = `alerts tuan tu, ${n} lan`;
}
pub.end(true);
socket.disconnect();

const all = mode === 'alerts' ? rows : tracker.rows;
const count = (s) => all.filter((r) => r.status === s).length;
const s = summarize(all.filter((r) => r.status === 'ok').map((r) => r.ms), TARGET_MS, count('mat'));
const sim = summarize(simRows.map((r) => r.ms), TARGET_MS);
const stamp = startedAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const machine = `${os.cpus()[0]?.model} x${os.cpus().length}, RAM ${Math.round(os.totalmem() / 2 ** 30)} GB (trong ${Math.round(os.freemem() / 2 ** 30)} GB luc ket thuc), Windows ${os.release()}, Node ${process.version}`;
const summary = [
  `# ${header}; bat dau ${startedAt}, ket thuc ${new Date().toISOString()}, tai khoan ${USER}${process.env.LATENCY_NOTE ? `; ${process.env.LATENCY_NOTE}` : ''}`,
  `# May: ${machine}`,
  `# Mau tu gui (publish -> ${mode === 'alerts' ? 'alert.created' : 'readings.new'}): gui=${all.length} ok=${s.n} mat=${s.lost} trung=${count('trung')}${mode === 'alerts' ? ` khong-mo=${count('khong-mo')}` : ''} p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max} vuot ${TARGET_MS} ms: ${(s.overTarget * 100).toFixed(1)}%`,
  `# So do khac (nhan - at, gom ca phan lam tron giay cua at): n=${sim.n} p50=${sim.p50} p95=${sim.p95} p99=${sim.p99} max=${sim.max}`,
].join('\n');
mkdirSync('results', { recursive: true });
const out = `results/latency-${mode}-${stamp}.csv`;
writeFileSync(out, `${summary}\n${toCsv([...all, ...(mode === 'alerts' ? tracker.rows : []), ...simRows])}`);
console.log(`${summary}\n-> ${out}`);
process.exit(0);
