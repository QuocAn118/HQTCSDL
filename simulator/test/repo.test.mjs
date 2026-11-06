
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

describe('Repository configuration', () => {
  it('uses ES modules and MQTT 5.16.1', () => {
    assert.equal(packageJson.type, 'module');
    assert.equal(packageJson.dependencies.mqtt, '5.16.1');
    assert.deepEqual(packageJson.devDependencies ?? {}, {});
  });

  it('has the required npm scripts', () => {
    assert.equal(packageJson.scripts.start, 'node scripts/check-env.mjs && node --env-file=.env src/main.mjs');
    assert.equal(packageJson.scripts.test, 'node --test');
  });

  it('.env.example contains exactly five variables', () => {
    const content = readFileSync(
      new URL('../.env.example', import.meta.url), 'utf8'
    );

    const variables = content
      .split(/\r?\n/)
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .map(line => line.split('=')[0]);

    assert.deepEqual(variables, [
      'MQTT_URL',
      'MQTT_USERNAME',
      'MQTT_PASSWORD',
      'READING_INTERVAL_SECONDS',
      'NOISE_SEED'
    ]);
  });

  it('.gitignore excludes simulator secrets and dependencies', () => {
    const content = readFileSync(
      new URL('../../.gitignore', import.meta.url), 'utf8'
    );

    assert.match(content, /^simulator\/\.env$/m);
    assert.match(content, /^simulator\/node_modules\/$/m);
  });

  it('check-env: thieu .env thi dung voi cau ro rang; co .env thi qua', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sim-env-'));

    try {
      mkdirSync(join(dir, 'scripts'));
      copyFileSync(
        new URL('../scripts/check-env.mjs', import.meta.url),
        join(dir, 'scripts', 'check-env.mjs')
      );

      const run = () => spawnSync(
        process.execPath,
        [join(dir, 'scripts', 'check-env.mjs')],
        { encoding: 'utf8' }
      );

      const missing = run();

      assert.equal(missing.status, 1);
      assert.ok(missing.stderr.includes('Chua co simulator/.env, chep tu .env.example'));

      writeFileSync(join(dir, '.env'), 'MQTT_URL=mqtt://localhost:1883');

      assert.equal(run().status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('README and spike files exist', () => {
    assert.equal(existsSync(new URL('../README.md', import.meta.url)), true);
    assert.equal(existsSync(new URL('../spikes/RESULTS.md', import.meta.url)), true);
    assert.equal(existsSync(new URL('../spikes/connections.mjs', import.meta.url)), true);
    assert.equal(existsSync(new URL('../spikes/drop-a.mjs', import.meta.url)), true);
  });
});
