
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  commandTopic,
  parseCommand,
  ActuatorState
} from '../src/commands.mjs';

const makeCommand = (overrides = {}) => ({
  isOn: true,
  level: 80,
  mode: 'AUTO',
  issuedAt: '2026-11-03T10:00:00.000Z',
  ...overrides
});

describe('MQTT commands', () => {
  it('creates the correct command topic', () => {
    assert.equal(
      commandTopic('H1-F0-FAN'),
      'swiftlet/devices/H1-F0-FAN/command'
    );
  });

  it('parses valid JSON command', () => {
    const command = parseCommand(
      Buffer.from(JSON.stringify(makeCommand()))
    );

    assert.equal(command.isOn, true);
    assert.equal(command.level, 80);
    assert.equal(command.mode, 'AUTO');
    assert.equal(
      command.issuedAtMs,
      Date.parse('2026-11-03T10:00:00.000Z')
    );
  });

  it('accepts null and decimal levels', () => {
    for (const level of [null, 0, 50.5, 100]) {
      const command = parseCommand(
        Buffer.from(JSON.stringify(makeCommand({ level })))
      );

      assert.equal(command.level, level);
    }
  });

  it('rejects invalid JSON', () => {
    assert.throws(
      () => parseCommand(Buffer.from('{invalid')),
      /Invalid command JSON/
    );
  });

  it('rejects invalid command fields', () => {
    const invalidCommands = [
      makeCommand({ isOn: 'true' }),
      makeCommand({ level: 101 }),
      makeCommand({ level: -1 }),
      makeCommand({ level: '50' }),
      makeCommand({ mode: 'UNKNOWN' }),
      makeCommand({ issuedAt: '2026-11-03' })
    ];

    for (const command of invalidCommands) {
      assert.throws(
        () => parseCommand(Buffer.from(JSON.stringify(command)))
      );
    }
  });

  it('rejects impossible dates', () => {
    assert.throws(
      () => parseCommand(
        Buffer.from(JSON.stringify(
          makeCommand({ issuedAt: '2026-02-30T10:00:00Z' })
        ))
      )
    );
  });

  it('rejects older commands', () => {
    const state = new ActuatorState();

    const first = parseCommand(
      Buffer.from(JSON.stringify(makeCommand()))
    );

    const older = parseCommand(
      Buffer.from(JSON.stringify(
        makeCommand({ issuedAt: '2026-11-03T09:00:00Z' })
      ))
    );

    assert.equal(state.apply(first), true);
    assert.equal(state.apply(older), false);
  });

  it('accepts commands with equal timestamps', () => {
    const state = new ActuatorState();

    const first = parseCommand(
      Buffer.from(JSON.stringify(makeCommand({ level: 50 })))
    );

    const second = parseCommand(
      Buffer.from(JSON.stringify(makeCommand({ level: 80 })))
    );

    assert.equal(state.apply(first), true);
    assert.equal(state.apply(second), true);
    assert.equal(state.getState().level, 80);
  });

  it('compares fractional milliseconds correctly', () => {
    const state = new ActuatorState();

    const first = parseCommand(
      Buffer.from(JSON.stringify(
        makeCommand({ issuedAt: '2026-11-03T10:00:00.500Z' })
      ))
    );

    const older = parseCommand(
      Buffer.from(JSON.stringify(
        makeCommand({ issuedAt: '2026-11-03T10:00:00.400Z' })
      ))
    );

    assert.equal(state.apply(first), true);
    assert.equal(state.apply(older), false);
  });
});
