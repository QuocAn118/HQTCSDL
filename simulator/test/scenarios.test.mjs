
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
