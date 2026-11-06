// Broker dut (khong phai --drop): client.connected = false, mqtt.js tu ket noi lai (spec 2.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadDevices } from '../src/devices.mjs';
import { loadScenario } from '../src/scenarios.mjs';
import { createSimulator, MAX_QUEUE_PER_DEVICE } from '../src/sim.mjs';

const SENSOR = 'H1-F1-SENSOR';

function fakeClient() {
  return {
    connected: true,
    messages: [],

    publish(topic, payload, options, callback) {
      this.messages.push({ topic, payload, options });
      callback?.(null);
    },

    async endAsync() {
      this.connected = false;
    }
  };
}

function setup() {
  const devices = loadDevices();
  const clients = new Map(devices.map(device => [device.code, fakeClient()]));
  const clock = { value: Date.UTC(2026, 10, 3, 10, 0, 7) };

  const simulator = createSimulator({
    scenario: loadScenario('normal'),
    clients,
    devices,
    reconnectClient: async () => fakeClient(),
    now: () => clock.value
  });

  return { simulator, client: clients.get(SENSOR), clock };
}

function tickAt(simulator, clock) {
  const at = simulator.tick().find(item => item.device === SENSOR).at;
  clock.value += 10_000;
  return at;
}

const ats = messages => messages.map(message => JSON.parse(message.payload)[0].at);

test('broker dut 3 nhip, ket noi lai: gui du 3 tin theo thu tu, giu at goc, hang doi ve 0', async () => {
  const { simulator, client, clock } = setup();

  client.connected = false;
  const expected = [tickAt(simulator, clock), tickAt(simulator, clock), tickAt(simulator, clock)];

  assert.equal(client.messages.length, 0);
  assert.equal(simulator.queueSize(SENSOR), 3);

  client.connected = true;
  await simulator.flush(SENSOR);

  assert.deepEqual(ats(client.messages), expected);
  assert.ok(client.messages.every(message => message.options.qos === 1));
  assert.equal(simulator.queueSize(SENSOR), 0);
});

test('tin moi sinh ra trong luc dang gui bu xep sau tin cu', async () => {
  const { simulator, client, clock } = setup();
  const acks = [];

  client.publish = function (topic, payload, options, callback) {
    this.messages.push({ topic, payload, options });
    acks.push(callback);
  };

  client.connected = false;
  const first = [tickAt(simulator, clock), tickAt(simulator, clock)];
  client.connected = true;

  const flushing = simulator.flush(SENSOR);
  const third = tickAt(simulator, clock);

  // Tin thu ba khong duoc gui thang khi hang doi con tin.
  assert.equal(client.messages.length, 1);
  assert.equal(simulator.queueSize(SENSOR), 3);

  while (acks.length > 0) {
    acks.shift()(null);
    await new Promise(resolve => setImmediate(resolve));
  }

  await flushing;

  assert.deepEqual(ats(client.messages), [...first, third]);
  assert.equal(simulator.queueSize(SENSOR), 0);
});

test('gui bu loi giua chung: giu phan con lai, lan ket noi sau gui tiep', async () => {
  const { simulator, client, clock } = setup();
  let calls = 0;

  client.publish = function (topic, payload, options, callback) {
    calls++;

    if (calls === 2) {
      callback(new Error('connection lost'));
      return;
    }

    this.messages.push({ topic, payload, options });
    callback(null);
  };

  client.connected = false;
  const expected = [tickAt(simulator, clock), tickAt(simulator, clock), tickAt(simulator, clock)];
  client.connected = true;

  await simulator.flush(SENSOR);

  assert.equal(client.messages.length, 1);
  assert.equal(simulator.queueSize(SENSOR), 2);

  await simulator.flush(SENSOR);

  assert.deepEqual(ats(client.messages), expected);
  assert.equal(simulator.queueSize(SENSOR), 0);
});

test('flush khong gui khi chua ket noi hoac dang bi --drop', async () => {
  const { simulator, client, clock } = setup();

  client.connected = false;
  tickAt(simulator, clock);

  await simulator.flush(SENSOR);
  assert.equal(simulator.queueSize(SENSOR), 1);

  await simulator.drop(SENSOR);
  client.connected = true;

  await simulator.flush(SENSOR);
  assert.equal(client.messages.length, 0);
  assert.equal(simulator.queueSize(SENSOR), 1);
});

test('hang doi co gioi han: day thi bo tin cu nhat, canh bao mot lan', async () => {
  const { simulator, client, clock } = setup();

  client.connected = false;

  const all = [];
  const warnings = [];
  const warn = console.warn;
  console.warn = message => warnings.push(message);

  try {
    for (let i = 0; i < MAX_QUEUE_PER_DEVICE + 5; i++) {
      all.push(tickAt(simulator, clock));
    }
  } finally {
    console.warn = warn;
  }

  assert.equal(simulator.queueSize(SENSOR), MAX_QUEUE_PER_DEVICE);
  assert.equal(warnings.filter(message => message.includes(SENSOR)).length, 1);

  client.connected = true;
  await simulator.flush(SENSOR);

  assert.deepEqual(ats(client.messages), all.slice(5));
});
