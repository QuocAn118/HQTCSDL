
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.mjs';

const validEnv = {
  MQTT_URL: 'mqtt://localhost:1883',
  MQTT_USERNAME: 'simulator',
  MQTT_PASSWORD: 'test-password',
  READING_INTERVAL_SECONDS: '10',
  NOISE_SEED: '1'
};

describe('Configuration', () => {
  it('loads valid configuration', () => {
    const config = loadConfig(validEnv);

    assert.equal(config.mqttUrl, 'mqtt://localhost:1883');
    assert.equal(config.username, 'simulator');
    assert.equal(config.readingIntervalSeconds, 10);
    assert.equal(config.noiseSeed, 1);
  });

  it('rejects missing variables', () => {
    const env = { ...validEnv };
    delete env.MQTT_PASSWORD;

    assert.throws(() => loadConfig(env), /Missing environment variable/);
  });

  it('rejects empty reading interval', () => {
    assert.throws(
      () => loadConfig({
        ...validEnv,
        READING_INTERVAL_SECONDS: ''
      })
    );
  });

  it('rejects zero or negative interval', () => {
    for (const value of ['0', '-5']) {
      assert.throws(() => loadConfig({
        ...validEnv,
        READING_INTERVAL_SECONDS: value
      }));
    }
  });

  it('rejects non-numeric interval', () => {
    assert.throws(() => loadConfig({
      ...validEnv,
      READING_INTERVAL_SECONDS: 'abc'
    }));
  });

  it('rejects invalid seed', () => {
    assert.throws(() => loadConfig({
      ...validEnv,
      NOISE_SEED: '1.5'
    }));
  });

  it('rejects unsupported MQTT protocol', () => {
    assert.throws(() => loadConfig({
      ...validEnv,
      MQTT_URL: 'http://localhost:1883'
    }));
  });
});
