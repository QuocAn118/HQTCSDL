// Thu vien fixture hop dong SwiftletCare: thay cho giu cho va so khop ket qua (spec integration-contract 4.3).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const TIME = /^(now|window)(?:([+-])(\d+)([smh]))?(?::(noZ|\+07:00))?$/;
const TOKEN = /\{\{([^{}]+)\}\}/g;
const MATCHER = /^\{\{any:(id|iso|string)\}\}$/;

const MATCHERS = {
  id: (v) => Number.isInteger(v) && v > 0,
  iso: (v) => typeof v === 'string' && ISO_Z.test(v),
  string: (v) => typeof v === 'string' && v.length > 0,
};

// Moc "now" cua mot ca test: lam tron xuong giay, lech khoi luoi 5 phut (tranh trung moc seed / cua so dem chim).
export function baseNow(date = new Date()) {
  const t = Math.floor(date.getTime() / 1000) * 1000;
  const d = new Date(t);
  return d.getUTCSeconds() === 0 && d.getUTCMinutes() % 5 === 0 ? new Date(t + 7000) : d;
}

function formatTime(ms, suffix) {
  if (suffix === '+07:00') return new Date(ms + UNIT_MS.h * 7).toISOString().slice(0, 19) + '+07:00';
  const s = new Date(ms).toISOString().slice(0, 19);
  return suffix === 'noZ' ? s : s + 'Z';
}

function resolve(name, ctx) {
  const t = TIME.exec(name);
  if (t) {
    const now = ctx.now.getTime();
    const base = t[1] === 'now' ? now : Math.floor(now / (5 * UNIT_MS.m)) * (5 * UNIT_MS.m);
    const delta = t[2] ? (t[2] === '-' ? -1 : 1) * Number(t[3]) * UNIT_MS[t[4]] : 0;
    return formatTime(base + delta, t[5]);
  }
  const [kind, a, b] = name.split(':');
  if (kind === 'ref' && a && b) return ctx.ref(a, b);
  if (kind === 'token' && a) return ctx.token(a);
  if (name === 'serviceKey') return ctx.serviceKey;
  if (name === 'devPassword') return ctx.devPassword;
  throw new Error(`Cho giu cho la: {{${name}}}`);
}

export function expand(value, ctx) {
  if (Array.isArray(value)) return value.map((v) => expand(v, ctx));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, ctx)]));
  }
  if (typeof value !== 'string' || MATCHER.test(value)) return value;
  const whole = /^\{\{(ref:[^{}]+)\}\}$/.exec(value);
  if (whole) return resolve(whole[1], ctx); // id dung mot minh -> so
  return value.replace(TOKEN, (_, name) => String(resolve(name, ctx)));
}

export function match(expected, actual, path = '$') {
  if (typeof expected === 'string') {
    const m = MATCHER.exec(expected);
    if (m) return MATCHERS[m[1]](actual) ? [] : [`${path}: ${JSON.stringify(actual)} khong khop any:${m[1]}`];
    if (ISO_Z.test(expected) && typeof actual === 'string' && ISO_Z.test(actual)) {
      return Date.parse(expected) === Date.parse(actual) ? [] : [`${path}: ${actual} khac ${expected}`];
    }
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return [`${path}: mong mang ${expected.length} phan tu, nhan ${JSON.stringify(actual)}`];
    }
    return expected.flatMap((e, i) => match(e, actual[i], `${path}[${i}]`));
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return [`${path}: mong object, nhan ${JSON.stringify(actual)}`];
    }
    const missing = Object.keys(expected).filter((k) => !Object.hasOwn(actual, k));
    const extra = Object.keys(actual).filter((k) => !Object.hasOwn(expected, k));
    if (missing.length || extra.length) return [`${path}: thieu [${missing}] thua [${extra}]`];
    return Object.keys(expected).flatMap((k) => match(expected[k], actual[k], `${path}.${k}`));
  }
  return Object.is(expected, actual) ? [] : [`${path}: ${JSON.stringify(actual)} khac ${JSON.stringify(expected)}`];
}

export function loadFixture(name, dir = FIXTURES_DIR) {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
}

// Ca chuoi after chay trong mot ca test, dung chung mot ctx (mot "now").
export function loadChain(name, dir = FIXTURES_DIR, seen = new Set()) {
  if (seen.has(name)) throw new Error(`after tao vong lap tai ${name}`);
  seen.add(name);
  const fixture = loadFixture(name, dir);
  const before = fixture.after ? loadChain(fixture.after, dir, seen) : [];
  return [...before, { name, fixture }];
}
