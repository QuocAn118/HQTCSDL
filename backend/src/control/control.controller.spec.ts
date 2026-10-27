/* eslint-disable @typescript-eslint/require-await -- gia lap ham async trong file test */
import type { SetActuatorArgs } from '../db/sp';
import { ControlController } from './control.controller';

const U = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };

function setup(isOnInDb: boolean | null = true) {
  const loop = {
    executeManual: jest.fn(async (a: SetActuatorArgs) => ({
      changed: true,
      deviceCode: 'H1-F1-FAN',
      mode: a.mode,
      isOn: a.isOn,
      level: a.level ?? 80,
    })),
    runZones: jest.fn(async () => undefined),
  };
  const db = {
    prisma: {
      devices: {
        findUnique: jest.fn(async () => ({ IsOn: isOnInDb, ZoneId: 10 })),
      },
      controlLogs: { findMany: jest.fn(async () => []) },
    },
  };
  return { c: new ControlController(loop as never, db as never), loop, db };
}

describe('ControlController.control', () => {
  it('MANUAL thieu isOn -> 400 fields [isOn]', async () => {
    const { c } = setup();
    await expect(c.control(3, { mode: 'MANUAL' }, U)).rejects.toMatchObject({
      status: 400,
      details: { fields: ['isOn'] },
    });
  });

  it('MANUAL: Source MANUAL, UserId tu JWT, mode mac dinh MANUAL; khong chay vong', async () => {
    const { c, loop } = setup();
    await c.control(3, { isOn: true, level: 80, reason: 'thu' }, U);
    expect(loop.executeManual).toHaveBeenCalledWith({
      deviceId: 3,
      isOn: true,
      level: 80,
      source: 'MANUAL',
      mode: 'MANUAL',
      userId: 2,
      reason: 'thu',
    });
    expect(loop.runZones).not.toHaveBeenCalled();
  });

  it('AUTO khong isOn: dien IsOn hien tai, level giu (null), chay vong cho khu vuc', async () => {
    const { c, loop } = setup(true);
    const r = await c.control(3, { mode: 'AUTO' }, U);
    expect(loop.executeManual).toHaveBeenCalledWith(
      expect.objectContaining({
        isOn: true,
        level: null,
        mode: 'AUTO',
        source: 'MANUAL',
      }),
    );
    expect(loop.runZones).toHaveBeenCalledWith([10]);
    expect(r).toEqual({
      changed: true,
      deviceCode: 'H1-F1-FAN',
      mode: 'AUTO',
      isOn: true,
      level: 80,
    });
  });
});
