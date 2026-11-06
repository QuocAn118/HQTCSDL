import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.mjs';

describe('Command line arguments', () => {
  it('uses normal scenario by default', () => {
    assert.deepEqual(parseArgs([]), {
      scenario: 'normal',
      drop: [],
      dropAfter: null,
      dropFor: null
    });
  });

  it('accepts hot scenario', () => {
    assert.equal(
      parseArgs(['--scenario', 'hot']).scenario,
      'hot'
    );
  });

  it('accepts dry scenario', () => {
    assert.equal(
      parseArgs(['--scenario', 'dry']).scenario,
      'dry'
    );
  });

  it('accepts drop option with device code', () => {
    const options = parseArgs([
      '--drop', 'H1-F1-SENSOR',
      '--drop-after', '1',
      '--drop-for', '7'
    ]);

    assert.deepEqual(options.drop, ['H1-F1-SENSOR']);
    assert.equal(options.dropAfter, 1);
    assert.equal(options.dropFor, 7);
  });

  it('accepts multiple options', () => {
    const options = parseArgs([
      '--scenario', 'hot',
      '--drop', 'H1-F1-SENSOR',
      '--drop-after', '1',
      '--drop-for', '7'
    ]);

    assert.equal(options.scenario, 'hot');
    assert.deepEqual(options.drop, ['H1-F1-SENSOR']);
    assert.equal(options.dropAfter, 1);
    assert.equal(options.dropFor, 7);
  });

  it('accepts multiple dropped devices', () => {
    const options = parseArgs([
      '--drop', 'H1-F1-SENSOR,H1-F2-SENSOR',
      '--drop-after', '1',
      '--drop-for', '7'
    ]);

    assert.deepEqual(options.drop, [
      'H1-F1-SENSOR',
      'H1-F2-SENSOR'
    ]);
  });

  it('rejects drop without device code', () => {
    assert.throws(() => parseArgs([
      '--drop'
    ]));
  });

  it('rejects drop without timing options', () => {
    assert.throws(() => parseArgs([
      '--drop', 'H1-F1-SENSOR'
    ]));
  });

  it('rejects invalid drop duration', () => {
    assert.throws(() => parseArgs([
      '--drop', 'H1-F1-SENSOR',
      '--drop-after', '1',
      '--drop-for', '0'
    ]));
  });

  it('rejects unknown scenario', () => {
    assert.throws(() => parseArgs([
      '--scenario', 'rain'
    ]));
  });

  it('rejects missing scenario value', () => {
    assert.throws(() => parseArgs([
      '--scenario'
    ]));
  });

  it('rejects an unknown --drop code at startup, naming it', () => {
    assert.throws(() => parseArgs([
      '--drop', 'H1-F1-SENSOR,H9-F1-SENSOR',
      '--drop-after', '1',
      '--drop-for', '7'
    ]), /H9-F1-SENSOR/);
  });

  it('rejects --drop on a camera because the simulator has no camera connection', () => {
    assert.throws(() => parseArgs([
      '--drop', 'H1-F0-CAMERA',
      '--drop-after', '1',
      '--drop-for', '7'
    ]), /H1-F0-CAMERA/);
  });

  it('rejects an empty --drop list', () => {
    assert.throws(() => parseArgs([
      '--drop', ' , ',
      '--drop-after', '1',
      '--drop-for', '7'
    ]));
  });

  it('rejects unknown argument', () => {
    assert.throws(() => parseArgs([
      '--unknown'
    ]));
  });
});