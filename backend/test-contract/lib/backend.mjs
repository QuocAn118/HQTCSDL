import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sleep, waitFor } from './util.mjs';

// Ghi file .env tam (trong thu muc tam, xoa khi dung) roi chay node dist/main.js voi ENV_FILE.
export function startBackend(env, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sc-contract-'));
  const file = join(dir, 'backend.env');
  const merged = { ...env, ...overrides };
  writeFileSync(file, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n'));
  const childEnv = { ...process.env, ENV_FILE: file, NODE_ENV: 'test' };
  for (const k of Object.keys(merged)) delete childEnv[k]; // khong de bien cua shell lan gia tri file
  const child = spawn(process.execPath, ['dist/main.js'], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  return { child, logs, port: Number(merged.PORT), dir };
}

// 90 s: may nhom nap module mat ~23 s truoc khi Nest bat dau (Defender quet node_modules), 30 s khong du (T22-L3).
export async function waitHealth(port, status, timeoutMs = 90_000) {
  return waitFor(async () => {
    const r = await fetch(`http://localhost:${port}/api/health`);
    const body = await r.json();
    return r.status === status && body.mqtt === 'connected' ? body : null;
  }, timeoutMs, `/api/health ${status}`);
}

// SIGINT, cho toi da 10 giay roi kill (spec backend 7.2). Tren Windows kill('SIGINT') co the ket thuc ngay.
export async function stopBackend(b) {
  if (b.child.exitCode === null) {
    const exited = new Promise((r) => b.child.once('exit', r));
    b.child.kill('SIGINT');
    const done = await Promise.race([exited.then(() => true), sleep(10_000).then(() => false)]);
    if (!done) b.child.kill('SIGKILL');
  }
  rmSync(b.dir, { recursive: true, force: true });
}
