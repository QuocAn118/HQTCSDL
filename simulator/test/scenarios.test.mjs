
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { equilibrium } from '../src/model.mjs';
import { offThresholds } from './rules-copy.mjs';

import {
  SCENARIOS,
  loadScenario,
  baseFor
} from '../src/scenarios.mjs';

describe('Environmental scenarios', () => {
  it('defines normal, hot and dry scenarios', () => {
    assert.deepEqual(SCENARIOS, ['normal', 'hot', 'dry']);
  });

  it('loads normal scenario defaults', () => {
    const scenario = loadScenario('normal');

    assert.equal(scenario.defaults.TEMP, 28);
    assert.equal(scenario.defaults.HUMID, 82);
    assert.equal(scenario.defaults.CO2, 600);
    assert.equal(scenario.defaults.LIGHT, 2);
  });

  it('loads hot scenario', () => {
    const scenario = loadScenario('hot');

    assert.equal(baseFor(scenario, 'H1-F2', 'TEMP'), 32);
    assert.equal(baseFor(scenario, 'H1-F1', 'TEMP'), 28);
  });

  it('loads dry scenario', () => {
    const scenario = loadScenario('dry');

    assert.equal(baseFor(scenario, 'H1-F3', 'HUMID'), 70);
    assert.equal(baseFor(scenario, 'H1-F2', 'HUMID'), 82);
  });

  it('uses default values for zones without overrides', () => {
    const scenario = loadScenario('normal');

    assert.equal(baseFor(scenario, 'H2-F0', 'TEMP'), 28);
    assert.equal(baseFor(scenario, 'H2-F0', 'CO2'), 600);
  });

  it('rejects unknown scenarios', () => {
    assert.throws(
      () => loadScenario('rainy'),
      /Unknown scenario/
    );
  });
});

// Nguong seed database-core (spec 1.5). Seed doi -> sua o day.
const TEMP = { min: 26, max: 30, target: 28, hysteresis: 0.5 };
const HUMID = { min: 75, max: 90, target: 82, hysteresis: 2 };
const CO2 = { min: null, max: 1000, target: null, hysteresis: 50 };

const on = type => [{ type, isOn: true, level: 100 }];

describe('Bat dang thuc voi nguong seed (spec 3.2)', () => {
  it('ban sao cong thuc cho cung ket qua bang ca backend (rules.spec.ts)', () => {
    assert.deepEqual(offThresholds(TEMP), { h: 0.5, offHi: 28, offLo: 28 });
    assert.deepEqual(offThresholds(HUMID), { h: 2, offHi: 82, offLo: 82 });
    assert.deepEqual(
      offThresholds({ min: 28, max: 30, target: null, hysteresis: 2 }),
      { h: 0.5, offHi: 29.5, offLo: 28.5 }
    );
    assert.deepEqual(offThresholds(CO2), { h: 50, offHi: 950, offLo: null });
    assert.equal(
      offThresholds({ min: 26, max: 30, target: 30, hysteresis: 0.5 }).offHi,
      29.5
    );
  });

  it('hot, H1-F2: nen TEMP > Max va can bang khi FAN bat < offHi', () => {
    const base = baseFor(loadScenario('hot'), 'H1-F2', 'TEMP');

    assert.ok(base > TEMP.max, `nen ${base}`);

    const balance = equilibrium('TEMP', base, on('FAN'));

    assert.ok(balance < offThresholds(TEMP).offHi, `can bang ${balance}`);
  });

  it('dry, H1-F3: nen HUMID < Min va can bang khi MIST bat > offLo', () => {
    const base = baseFor(loadScenario('dry'), 'H1-F3', 'HUMID');

    assert.ok(base < HUMID.min, `nen ${base}`);

    const balance = equilibrium('HUMID', base, on('MIST'));

    assert.ok(balance > offThresholds(HUMID).offLo, `can bang ${balance}`);
  });

  it('normal: moi nen nam trong nguong, khong luat nao bat', () => {
    const normal = loadScenario('normal');
    const temp = baseFor(normal, 'H1-F1', 'TEMP');
    const humid = baseFor(normal, 'H1-F1', 'HUMID');

    assert.ok(temp >= TEMP.min && temp <= TEMP.max);
    assert.ok(humid >= HUMID.min && humid <= HUMID.max);
    assert.ok(baseFor(normal, 'H1-F1', 'CO2') <= CO2.max);
  });

  it('JSON kich ban nam o src/scenarios/ (spec 1.3)', () => {
    for (const name of SCENARIOS) {
      assert.equal(
        existsSync(new URL(`../src/scenarios/${name}.json`, import.meta.url)),
        true
      );
    }
  });
});
