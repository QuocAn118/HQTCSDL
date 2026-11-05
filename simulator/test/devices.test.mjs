
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEVICE_TYPES,
  parseCode,
  loadDevices,
  isSensor,
  isActuator
} from '../src/devices.mjs';

describe('Device management', () => {
  it('defines the five supported device types', () => {
    assert.deepEqual(DEVICE_TYPES, [
      'SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER'
    ]);
  });

  it('parses device code correctly', () => {
    assert.deepEqual(parseCode('H1-F2-FAN'), {
      code: 'H1-F2-FAN',
      type: 'FAN',
      zone: 'H1-F2'
    });
  });

  it('loads 26 devices and excludes cameras', () => {
    const devices = loadDevices();

    assert.equal(devices.length, 26);
    assert.equal(
      devices.some(device => device.type === 'CAMERA'),
      false
    );
  });

  it('has the expected device distribution', () => {
    const devices = loadDevices();

    for (const type of ['SENSOR', 'MIST', 'FAN', 'HEATER']) {
      assert.equal(
        devices.filter(device => device.type === type).length,
        6
      );
    }

    assert.equal(
      devices.filter(device => device.type === 'SPEAKER').length,
      2
    );
  });

  it('classifies sensors and actuators correctly', () => {
    const devices = loadDevices();

    assert.equal(devices.filter(isSensor).length, 6);
    assert.equal(devices.filter(isActuator).length, 20);
  });

  it('rejects unknown device types', () => {
    assert.throws(
      () => parseCode('H1-F2-LAMP'),
      /Unknown device/
    );
  });
});
