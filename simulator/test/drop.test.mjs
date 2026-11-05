import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadDevices, isActuator, isSensor } from '../src/devices.mjs';
import { loadScenario } from '../src/scenarios.mjs';
import { createSimulator } from '../src/sim.mjs';
import { heartbeatTopic, readingsTopic } from '../src/readings.mjs';

function createFakeClient() {
  return {
    connected: true,
    messages: [],
    ended: false,

    publish(topic, payload, options, callback) {
      this.messages.push({
        topic,
        payload,
        options
      });

      if (callback) {
        callback(null);
      }
    },

    async endAsync() {
      this.connected = false;
      this.ended = true;
    }
  };
}

function setup() {
  const devices = loadDevices();
  const clients = new Map();

  for (const device of devices) {
    clients.set(device.code, createFakeClient());
  }

  const clock = {
    value: Date.UTC(2026, 9, 12, 10, 40, 7)
  };

  const reconnectClient = async () => createFakeClient();

  const simulator = createSimulator({
    scenario: loadScenario('normal'),
    clients,
    reconnectClient,
    devices,
    now: () => clock.value
  });

  return {
    simulator,
    clients,
    devices,
    clock
  };
}

test('heartbeat sends QoS 0 only for actuators', () => {
  const {
    simulator,
    clients,
    devices
  } = setup();

  simulator.heartbeat();

  const actuators = devices.filter(isActuator);
  const sensors = devices.filter(isSensor);

  let heartbeatCount = 0;

  for (const device of actuators) {
    const messages = clients.get(device.code).messages;

    const heartbeat = messages.find(
      message => message.topic === heartbeatTopic(device.code)
    );

    assert.ok(heartbeat);
    assert.equal(heartbeat.options.qos, 0);

    const payload = JSON.parse(heartbeat.payload);

    assert.ok(payload.device);
    assert.ok(payload.at);

    heartbeatCount++;
  }

  for (const device of sensors) {
    const messages = clients.get(device.code).messages;

    assert.equal(
      messages.some(
        message => message.topic === heartbeatTopic(device.code)
      ),
      false
    );
  }

  assert.equal(heartbeatCount, 20);
});

test('drop disconnects the device and queues QoS 1 readings', async () => {
  const {
    simulator,
    clients,
    devices
  } = setup();

  const sensor = devices.find(
    device => device.code === 'H1-F1-SENSOR'
  );

  assert.ok(sensor);

  const oldClient = clients.get(sensor.code);

  await simulator.drop(sensor.code);

  assert.equal(oldClient.ended, true);
  assert.equal(oldClient.connected, false);

  simulator.tick();
  simulator.tick();

  assert.equal(oldClient.messages.length, 0);

  assert.equal(
    simulator.dropped.has(sensor.code),
    true
  );
});

test('restore reconnects and sends queued readings in order', async () => {
  const {
    simulator,
    clients,
    devices
  } = setup();

  const sensor = devices.find(
    device => device.code === 'H1-F1-SENSOR'
  );

  assert.ok(sensor);

  const oldClient = clients.get(sensor.code);

  let newClient;

  const reconnectClient = async () => {
    newClient = createFakeClient();
    return newClient;
  };

  // Tạo simulator với reconnectClient có thể kiểm tra.
  const simulatorWithReconnect = createSimulator({
    scenario: loadScenario('normal'),
    clients,
    reconnectClient,
    devices
  });

  await simulatorWithReconnect.drop(sensor.code);

  simulatorWithReconnect.tick();
  simulatorWithReconnect.tick();

  await simulatorWithReconnect.restore(sensor.code);

  assert.equal(oldClient.ended, true);
  assert.ok(newClient);

  const sentReadings = newClient.messages.filter(
    message => message.topic === readingsTopic(sensor.code)
  );

  assert.equal(sentReadings.length, 2);

  assert.equal(
    simulatorWithReconnect.dropped.has(sensor.code),
    false
  );
});