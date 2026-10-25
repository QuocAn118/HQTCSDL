/* eslint-disable @typescript-eslint/require-await -- gia lap ping async trong file test */
import { HealthController } from './health.controller';

const res = () => {
  const r = {
    code: 0,
    status(c: number) {
      r.code = c;
      return r;
    },
  };
  return r;
};

describe('HealthController', () => {
  it.each([
    [true, true, true, 200, { status: 'ok', db: 'ok', mqtt: 'connected' }],
    [
      true,
      false,
      true,
      503,
      { status: 'error', db: 'down', mqtt: 'connected' },
    ],
    [
      false,
      true,
      true,
      503,
      { status: 'error', db: 'down', mqtt: 'connected' },
    ],
    [
      true,
      true,
      false,
      503,
      { status: 'error', db: 'ok', mqtt: 'disconnected' },
    ],
  ])(
    'ready=%s ping=%s mqtt=%s -> %i',
    async (ready, ping, mqtt, code, body) => {
      const db = { isReady: () => ready, ping: async () => ping };
      const r = res();
      expect(
        await new HealthController(db as never, {
          isConnected: () => mqtt,
        }).health(r as never),
      ).toEqual(body);
      expect(r.code).toBe(code);
    },
  );

  it('chua co MqttStatus -> disconnected', async () => {
    const r = res();
    expect(
      await new HealthController(
        { isReady: () => true, ping: async () => true } as never,
        undefined,
      ).health(r as never),
    ).toMatchObject({ mqtt: 'disconnected' });
  });
});
