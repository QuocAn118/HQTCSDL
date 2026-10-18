import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function directives(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(/\s+/);
    map.set(key, rest.join(' '));
  }
  return map;
}

test('mosquitto.conf: dung cac chi thi spec 1.7', () => {
  const d = directives(read('infra/mosquitto/mosquitto.conf'));
  assert.equal(d.get('listener'), '1883 127.0.0.1', 'mac dinh chi nghe tren may nay');
  assert.equal(d.get('allow_anonymous'), 'false');
  assert.equal(d.get('password_file'), 'infra/mosquitto/passwd');
  assert.equal(d.get('persistence'), 'true');
  assert.equal(d.get('persistence_location'), 'infra/mosquitto/data/');
  assert.equal(d.get('max_queued_messages'), '10000');
});

test('mosquitto.conf: khong chua mat khau hay tai khoan', () => {
  const text = read('infra/mosquitto/mosquitto.conf');
  assert.doesNotMatch(text, /\$7\$|\$6\$/, 'khong chua hash mat khau');
  assert.ok(!directives(text).has('password'), 'khong co chi thi password');
});

test('.gitignore: bo qua file mat khau va du lieu broker', () => {
  const lines = read('.gitignore').split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes('infra/mosquitto/passwd'));
  assert.ok(lines.includes('infra/mosquitto/data/'));
  assert.ok(lines.includes('infra/mosquitto/*.local.conf'));
});
