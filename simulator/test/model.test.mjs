
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  METRICS,
  TAU_MINUTES,
  effectPerMinute,
  equilibrium,
  step,
  outputValue
} from '../src/model.mjs';

describe('Environmental model', () => {
  it('defines four environmental metrics', () => {
    assert.deepEqual(METRICS, ['TEMP', 'HUMID', 'CO2', 'LIGHT']);
  });

  it('uses a time constant of 3 minutes', () => {
    assert.equal(TAU_MINUTES, 3);
  });

  it('FAN reduces temperature and CO2', () => {
    const fan = [{ type: 'FAN', isOn: true, level: 100 }];

    assert.equal(effectPerMinute('TEMP', fan), -1.5);
    assert.equal(effectPerMinute('CO2', fan), -150);
  });

  it('HEATER increases temperature', () => {
    const heater = [{ type: 'HEATER', isOn: true, level: 100 }];

    assert.equal(effectPerMinute('TEMP', heater), 1.5);
  });

  it('MIST increases humidity', () => {
    const mist = [{ type: 'MIST', isOn: true, level: 100 }];

    assert.equal(effectPerMinute('HUMID', mist), 5);
  });

  it('supports half power and zero power', () => {
    const fan = [{ type: 'FAN', isOn: true, level: 50 }];
    const offFan = [{ type: 'FAN', isOn: true, level: 0 }];

    assert.equal(effectPerMinute('TEMP', fan), -0.75);
    assert.equal(effectPerMinute('TEMP', offFan), 0);
  });

  it('handles null and undefined levels as full power', () => {
    const fanNull = [{ type: 'FAN', isOn: true, level: null }];
    const fanUndefined = [{ type: 'FAN', isOn: true }];

    assert.equal(effectPerMinute('TEMP', fanNull), -1.5);
    assert.equal(effectPerMinute('TEMP', fanUndefined), -1.5);
  });

  it('does not apply effects when actuator is off', () => {
    const fan = [{ type: 'FAN', isOn: false, level: 100 }];

    assert.equal(effectPerMinute('TEMP', fan), 0);
  });

  it('keeps current value when time does not advance', () => {
    assert.equal(step(30, 20, 0), 30);
    assert.equal(step(30, 20, -10), 30);
  });

  it('moves toward target over time', () => {
    const result = step(30, 20, 60);

    assert.ok(result < 30);
    assert.ok(result > 20);
  });

  it('calculates equilibrium correctly', () => {
    const fan = [{ type: 'FAN', isOn: true, level: 100 }];

    assert.equal(equilibrium('TEMP', 30, fan), 25.5);
  });

  it('clamps and rounds output values', () => {
    assert.equal(outputValue('TEMP', 100), 60);
    assert.equal(outputValue('HUMID', -10), 0);
    assert.equal(outputValue('TEMP', 28.126), 28.13);
  });

  it('does not produce NaN for valid actuator levels', () => {
    const actuators = [
      { type: 'FAN', isOn: true, level: 0 },
      { type: 'FAN', isOn: true, level: null }
    ];

    assert.ok(Number.isFinite(effectPerMinute('TEMP', actuators)));
  });
});
