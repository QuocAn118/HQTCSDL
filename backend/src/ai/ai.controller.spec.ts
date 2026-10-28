/* eslint-disable @typescript-eslint/require-await -- gia lap SP/Prisma async */
import { AiController, birdCountsPipe } from './ai.controller';

describe('birdCountsPipe', () => {
  const meta = { type: 'body' as const };
  it('thieu Z -> fields ["windowStart"] (fixture bird-counts.invalid-missing-z)', async () => {
    await expect(
      birdCountsPipe.transform(
        [
          {
            camera: 'H1-F0-CAMERA',
            windowStart: '2026-10-12T10:40:00',
            in: 5,
            out: 1,
          },
        ],
        meta,
      ),
    ).rejects.toMatchObject({
      status: 400,
      details: { fields: ['windowStart'] },
    });
  });

  it.each([[{ camera: 'H1-F0-CAMERA' }], [null], [5]])(
    'body khong phai mang (%j) -> 400 fields ["body"], khong 500',
    async (body) => {
      await expect(birdCountsPipe.transform(body, meta)).rejects.toMatchObject({
        status: 400,
        details: { fields: ['body'] },
      });
    },
  );
});

const item = (camera = 'H1-F0-CAMERA') => ({
  camera,
  windowStart: '2026-10-12T10:40:00Z',
  in: 5,
  out: 1,
});

function setup(upserted = 1) {
  const sp = {
    recordBirdCount: jest.fn(async () => ({
      windowsUpserted: upserted,
      windowsUnchanged: 0,
    })),
  };
  const db = {
    prisma: {
      devices: {
        findMany: jest.fn(async () => [
          { DeviceId: 3, Zone: { HouseId: 1 } },
          { DeviceId: 8, Zone: { HouseId: 2 } },
        ]),
      },
    },
  };
  const rt = { emitToHouse: jest.fn() };
  return {
    c: new AiController(sp as never, db as never, rt as never, {} as never),
    sp,
    db,
    rt,
  };
}

describe('AiController.birdCounts (spec backend 5.7)', () => {
  it('mang rong -> 400; > 500 phan tu -> 413', async () => {
    const { c } = setup();
    await expect(c.birdCounts([])).rejects.toMatchObject({
      status: 400,
      details: { fields: ['body'] },
    });
    await expect(
      c.birdCounts(Array.from({ length: 501 }, () => item()) as never),
    ).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('windowsUpserted > 0 -> birdcount.updated moi camera trong lo (mot truy van)', async () => {
    const { c, rt, db } = setup(2);
    expect(
      await c.birdCounts([item(), item('H2-F0-CAMERA'), item()] as never),
    ).toEqual({ windowsUpserted: 2, windowsUnchanged: 0 });
    expect(db.prisma.devices.findMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.devices.findMany.mock.calls[0][0]).toMatchObject({
      where: { Code: { in: ['H1-F0-CAMERA', 'H2-F0-CAMERA'] } },
    });
    expect(rt.emitToHouse.mock.calls).toEqual([
      [1, 'birdcount.updated', { houseId: 1, cameraId: 3 }],
      [2, 'birdcount.updated', { houseId: 2, cameraId: 8 }],
    ]);
  });

  it('windowsUpserted = 0 -> khong phat', async () => {
    const { c, rt } = setup(0);
    await c.birdCounts([item()] as never);
    expect(rt.emitToHouse).not.toHaveBeenCalled();
  });
});
