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