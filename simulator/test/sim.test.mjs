import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSimulator } from '../src/sim.mjs';
import { loadScenario } from '../src/scenarios.mjs';
import { parseCommand } from '../src/commands.mjs';
import { FakeClient } from './fake-client.mjs';

function setup() {
  let currentTime = Date.parse('2026-11-03T10:00:00Z');

  const sensorClient = new FakeClient();

  const devices = [
    {
      code: 'H1-F0-SENSOR',
      type: 'SENSOR',
      zone: 'H1-F0'
    },
    {
      code: 'H1-F0-FAN',
      type: 'FAN',
      zone: 'H1-F0'
    }
  ];

  const clients = new Map([
    ['H1-F0-SENSOR', sensorClient]
  ]);

  const simulator = createSimulator({
    scenario: loadScenario('normal'),
    clients,
    devices,
    now: () => currentTime
  });

  return {
    simulator,
    sensorClient,
    advanceTime: seconds => {
      currentTime += seconds * 1000;
    }
  };
}

describe('Simulator', () => {
  it('initializes environment from scenario', () => {
    const { simulator } = setup();

    assert.equal(
      simulator.getEnvironment('H1-F0').TEMP,
      28
    );

    assert.equal(
      simulator.getEnvironment('H1-F0').HUMID,
      82
    );
  });

  it('publishes four readings in one message for each sensor', () => {
    const { simulator, sensorClient } = setup();

    const readings = simulator.tick();

    // tick vẫn trả về 4 readings
    assert.equal(readings.length, 4);

    // MQTT gửi 1 message chứa cả 4 readings
    assert.equal(sensorClient.published.length, 1);

    const payload = JSON.parse(
      sensorClient.published[0].message
    );

    assert.equal(payload.length, 4);

    assert.deepEqual(
      payload.map(item => item.metric),
      ['TEMP', 'HUMID', 'CO2', 'LIGHT']
    );

    assert.ok(
      payload.every(item => item.device === 'H1-F0-SENSOR')
    );
  });

  it('publishes readings with QoS 1 and retain false', () => {
    const { simulator, sensorClient } = setup();

    simulator.tick();

    const published = sensorClient.published[0];

    assert.equal(
      published.topic,
      'swiftlet/devices/H1-F0-SENSOR/readings'
    );

    assert.equal(published.options.qos, 1);
    assert.equal(published.options.retain, false);
  });

  it('actuators are off by default', () => {
    const { simulator } = setup();

    assert.equal(
      simulator.getActuatorState('H1-F0-FAN'),
      null
    );
  });

  it('accepts a command for an actuator', () => {
    const { simulator } = setup();

    const command = parseCommand(Buffer.from(JSON.stringify({
      isOn: true,
      level: 100,
      mode: 'MANUAL',
      issuedAt: '2026-11-03T10:00:00Z'
    })));

    assert.equal(
      simulator.setCommand('H1-F0-FAN', command),
      true
    );

    assert.equal(
      simulator.getActuatorState('H1-F0-FAN').isOn,
      true
    );
  });

  it('rejects commands for unknown actuators', () => {
    const { simulator } = setup();

    assert.throws(
      () => simulator.setCommand('H1-F0-LAMP', {}),
      /Unknown actuator/
    );
  });

  it('fan reduces temperature over time', () => {
    const { simulator, advanceTime } = setup();

    simulator.tick();

    const initialTemp = simulator.getEnvironment('H1-F0').TEMP;

    const command = parseCommand(Buffer.from(JSON.stringify({
      isOn: true,
      level: 100,
      mode: 'MANUAL',
      issuedAt: '2026-11-03T10:00:00Z'
    })));

    simulator.setCommand('H1-F0-FAN', command);

    advanceTime(60);
    simulator.tick();

    const newTemp = simulator.getEnvironment('H1-F0').TEMP;

    assert.ok(newTemp < initialTemp);
  });

  it('keeps readings timestamps increasing when clock moves backward', () => {
    const { simulator, sensorClient, advanceTime } = setup();

    simulator.tick();

    const firstPayload = JSON.parse(
      sensorClient.published[0].message
    );

    const first = firstPayload[0].at;

    advanceTime(-10);
    simulator.tick();

    const secondPayload = JSON.parse(
      sensorClient.published[1].message
    );

    const second = secondPayload[0].at;

    assert.ok(Date.parse(second) > Date.parse(first));
  });
});

// Spec 2.2: khoi dong tu muc normal roi troi dan ve nen cua kich ban.
function startupValues(scenarioName, code, zone, metric) {
  let currentTime = Date.parse('2026-11-03T10:00:00Z');

  const client = new FakeClient();
  const simulator = createSimulator({
    scenario: loadScenario(scenarioName),
    clients: new Map([[code, client]]),
    devices: [{ code, type: 'SENSOR', zone }],
    now: () => currentTime
  });

  const values = [];

  for (let i = 0; i < 12; i++) {
    const reading = simulator.tick().find(item => item.metric === metric);
    values.push(reading.value);
    currentTime += 10_000;
  }

  return values;
}

describe('Khoi dong kich ban (spec 2.2)', () => {
  it('hot: H1-F2 bat dau o 28 do roi tang don dieu ve 32', () => {
    const temps = startupValues('hot', 'H1-F2-SENSOR', 'H1-F2', 'TEMP');

    assert.equal(temps[0], 28);

    for (let i = 1; i < temps.length; i++) {
      assert.ok(temps[i] > temps[i - 1], `tick ${i}: ${temps}`);
    }

    assert.ok(temps.at(-1) < 32);
  });

  it('dry: H1-F3 bat dau o 82 % roi giam don dieu ve 70', () => {
    const humids = startupValues('dry', 'H1-F3-SENSOR', 'H1-F3', 'HUMID');

    assert.equal(humids[0], 82);

    for (let i = 1; i < humids.length; i++) {
      assert.ok(humids[i] < humids[i - 1], `tick ${i}: ${humids}`);
    }

    assert.ok(humids.at(-1) > 70);
  });
});
