import { createHmac } from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cho dieu kien, khong ngu co dinh (spec backend 7.2).
export async function waitFor(fn, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(200);
  }
  throw new Error(`Qua ${timeoutMs} ms cho ${label}${last ? `: ${last.message}` : ''}`);
}

// Ky JWT HS256 tai cho cho chuoi "CSDL chua san sang" (khong dang nhap duoc).
export function signHs256(secret, payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b({ alg: 'HS256', typ: 'JWT' })}.${b(payload)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}
