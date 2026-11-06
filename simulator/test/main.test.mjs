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

  function connectingClient(created) {
    return (url, options) => {
      const client = new FakeClient();

      client.connected = true;
      client.clientId = options.clientId;
      client.published = [];
      client.publish = (topic, payload, publishOptions, callback) => {
        client.published.push(payload);
        callback?.(null);
      };
      client.endAsync = async () => {
        client.connected = false;
      };

      created.push(client);
      return client;
    };
  }

  it('sends queued readings when the client reconnects after a broker outage', async () => {
    const created = [];

    const result = startMain({
      env: createEnvironment(),
      connect: connectingClient(created),
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {}
    });

    const sensor = created.find(client => client.clientId === 'H1-F1-SENSOR');

    sensor.connected = false;
    result.simulator.tick();
    result.simulator.tick();
    assert.equal(sensor.published.length, 0);

    sensor.connected = true;
    sensor.emit('connect');
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(sensor.published.length, 2);
    assert.equal(result.simulator.queueSize('H1-F1-SENSOR'), 0);

    result.stop();
  });

  it('keeps waiting when the broker is still down after --drop-for', async () => {
    const created = [];
    const timers = [];

    const result = startMain({
      env: createEnvironment(),
      argv: ['--drop', 'H1-F1-SENSOR', '--drop-after', '1', '--drop-for', '7'],
      connect: connectingClient(created),
      logger: { log() {}, error() {} },
      processLike: new EventEmitter(),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
      setTimeoutFn: callback => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeoutFn: () => {}
    });

    await timers.shift()();
    result.simulator.tick();

    const restoring = timers.shift()();
    const fresh = created.at(-1);

    fresh.emit('error', new Error('ECONNREFUSED'));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(result.simulator.dropped.has('H1-F1-SENSOR'), true);

    fresh.emit('connect');
    await restoring;

    assert.equal(result.simulator.dropped.has('H1-F1-SENSOR'), false);
    assert.equal(fresh.published.length, 1);

    result.stop();
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