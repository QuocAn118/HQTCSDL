import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { startMain } from '../src/main.mjs';

class FakeClient extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = [];
    this.ended = false;
    this.endCalls = 0;
  }

  publish() {}

  subscribe(topic, options) {
    this.subscriptions.push({ topic, options });
  }

  end() {
    this.ended = true;
    this.endCalls++;
  }
}

function createEnvironment() {
  return {
    MQTT_URL: 'mqtt://localhost:1883',
    MQTT_USERNAME: 'simulator',
    MQTT_PASSWORD: 'test-password',
    READING_INTERVAL_SECONDS: '10',
    NOISE_SEED: '1'
  };
}

describe('Main simulator', () => {
  it('creates one MQTT client per device', () => {
    const clientsCreated = [];

    const result = startMain({
      env: createEnvironment(),
      connect: (url, options) => {
        const client = new FakeClient();
        clientsCreated.push({ url, options, client });
        return client;
      },
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    assert.equal(result.clients.size, 26);
    assert.equal(clientsCreated.length, 26);

    result.stop();
  });

  it('uses device code as MQTT client ID', () => {
    const ids = [];

    const result = startMain({
      env: createEnvironment(),
      connect: (url, options) => {
        ids.push(options.clientId);
        return new FakeClient();
      },
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    assert.equal(new Set(ids).size, 26);
    assert.ok(ids.includes('H1-F0-SENSOR'));
    assert.ok(ids.includes('H1-F0-FAN'));

    result.stop();
  });

  it('subscribes actuators to command topics after connecting', () => {
    const clients = [];

    const result = startMain({
      env: createEnvironment(),
      connect: () => {
        const client = new FakeClient();
        clients.push(client);
        return client;
      },
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    for (const client of clients) {
      client.emit('connect');
    }

    const subscriptions = clients.flatMap(
      client => client.subscriptions
    );

    assert.equal(subscriptions.length, 20);

    assert.ok(subscriptions.some(
      item => item.topic === 'swiftlet/devices/H1-F0-FAN/command'
    ));

    assert.ok(subscriptions.every(
      item => item.options.qos === 1
    ));

    result.stop();
  });

  it('closes all MQTT clients when stopped', () => {
    const clients = [];

    const result = startMain({
      env: createEnvironment(),
      connect: () => {
        const client = new FakeClient();
        clients.push(client);
        return client;
      },
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    result.stop();

    assert.ok(clients.every(client => client.ended));
  });

  it('stops only once', () => {
    let clearCount = 0;

    const clients = [];

    const result = startMain({
      env: createEnvironment(),
      connect: () => {
        const client = new FakeClient();
        clients.push(client);
        return client;
      },
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => clearCount++
    });

    result.stop();
    result.stop();

    // Một interval đọc sensor và một interval heartbeat.
    assert.equal(clearCount, 2);

    // Mỗi MQTT client chỉ được đóng một lần.
    assert.ok(clients.every(client => client.endCalls === 1));
  });

  it('logs MQTT errors without exposing credentials', () => {
    const errors = [];

    const result = startMain({
      env: createEnvironment(),
      connect: () => {
        const client = new FakeClient();

        queueMicrotask(() => {
          client.emit('error', new Error('Connection refused'));
        });

        return client;
      },
      logger: {
        log() {},
        error(message) {
          errors.push(message);
        }
      },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    return new Promise(resolve => {
      setImmediate(() => {
        assert.ok(errors.some(
          message => message.includes('MQTT connection error')
        ));

        assert.ok(!errors.some(
          message => message.includes('test-password')
        ));

        result.stop();
        resolve();
      });
    });
  });
});