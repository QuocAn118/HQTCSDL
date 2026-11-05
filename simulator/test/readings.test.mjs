
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isoSecond,
  nextAt,
  buildReadings,
  readingsTopic
} from '../src/readings.mjs';

describe('Readings', () => {
  it('converts timestamp to ISO UTC without milliseconds', () => {
    assert.equal(
      isoSecond(Date.parse('2026-11-03T10:20:30.456Z')),
      '2026-11-03T10:20:30.000Z'
    );
  });

  it('rounds timestamp down to the nearest second', () => {
    assert.equal(
      isoSecond(1999),
      '1970-01-01T00:00:01.000Z'
    );
  });

  it('ensures timestamp strictly increases', () => {
    assert.equal(nextAt(1000, 1500), 2000);
    assert.equal(nextAt(1000, 2500), 2000);
    assert.equal(nextAt(1000, 3000), 3000);
  });

  it('builds four metric readings', () => {
    const values = {
      TEMP: 28,
      HUMID: 82,
      CO2: 600,
      LIGHT: 2
    };

    const readings = buildReadings(
      'H1-F0-SENSOR',
      values,
      Date.parse('2026-11-03T10:20:30Z')
    );

    assert.equal(readings.length, 4);

    assert.deepEqual(
      readings.map(reading => reading.metric),
      ['TEMP', 'HUMID', 'CO2', 'LIGHT']
    );

    assert.equal(readings[0].device, 'H1-F0-SENSOR');
    assert.equal(readings[0].value, 28);
    assert.equal(readings[0].at, '2026-11-03T10:20:30.000Z');
  });

  it('creates the correct MQTT readings topic', () => {
    assert.equal(
      readingsTopic('H1-F0-SENSOR'),
      'swiftlet/devices/H1-F0-SENSOR/readings'
    );
  });
});
