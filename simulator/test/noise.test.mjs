
import test from 'node:test';
import assert from 'node:assert/strict';

import { createRandom, makeNoise } from '../src/noise.mjs';

test('Noise generator produces repeatable random values with the same seed', () => {
  const random1 = createRandom(12345);
  const random2 = createRandom(12345);

  for (let i = 0; i < 10; i++) {
    assert.equal(random1(), random2());
  }
});

test('Different seeds produce different random sequences', () => {
  const random1 = createRandom(12345);
  const random2 = createRandom(67890);

  const values1 = Array.from({ length: 5 }, () => random1());
  const values2 = Array.from({ length: 5 }, () => random2());

  assert.notDeepEqual(values1, values2);
});

test('Noise stays within the configured metric limits', () => {
  const limits = {
    TEMP: 0.05,
    HUMID: 0.2,
    CO2: 5,
    LIGHT: 0.05
  };

  const noise = makeNoise(12345);

  for (const [metric, limit] of Object.entries(limits)) {
    for (let i = 0; i < 1000; i++) {
      const value = noise(metric);

      assert.ok(
        value >= -limit && value <= limit,
        `${metric} noise ${value} is outside ±${limit}`
      );
    }
  }
});

test('makeNoise(null) always returns zero', () => {
  const noise = makeNoise(null);

  assert.equal(noise('TEMP'), 0);
  assert.equal(noise('HUMID'), 0);
  assert.equal(noise('CO2'), 0);
  assert.equal(noise('LIGHT'), 0);
});

test('Rejects unsupported metrics', () => {
  const noise = makeNoise(12345);

  assert.throws(
    () => noise('UNKNOWN'),
    /Unsupported metric/
  );
});

test('Rejects invalid seeds', () => {
  assert.throws(() => makeNoise(-1));
  assert.throws(() => makeNoise(1.5));
  assert.throws(() => makeNoise('123'));
});
