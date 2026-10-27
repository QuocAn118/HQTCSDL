/* eslint-disable @typescript-eslint/require-await -- gia lap Prisma async; mock.calls cua jest.fn la any */
import { BirdsController } from './birds.controller';

describe('BirdsController', () => {
  it('bird-flow: ngay VN dang chuoi; bird-counts: khoang [from, to) theo camera', async () => {
    const findMany = jest.fn(async () => [
      {
        CountId: 1,
        CameraId: 7,
        WindowStart: new Date(Date.UTC(2026, 9, 12, 10)),
        InCount: 5,
        OutCount: 1,
      },
    ]);
    const db = {
      prisma: {
        $queryRawUnsafe: jest.fn(async () => [
          {
            HouseId: 1,
            DayVn: new Date(Date.UTC(2026, 9, 12)),
            InTotal: 10,
            OutTotal: 3,
            Net: 7,
          },
        ]),
        birdCounts: { findMany },
      },
    };
    const c = new BirdsController(db as never);
    expect(
      await c.flow(1, { fromVnDate: '2026-10-05', toVnDate: '2026-10-13' }),
    ).toEqual([
      { houseId: 1, dayVn: '2026-10-12', inTotal: 10, outTotal: 3, net: 7 },
    ]);
    expect(
      await c.counts(7, {
        from: '2026-10-12T00:00:00Z',
        to: '2026-10-13T00:00:00Z',
      }),
    ).toEqual([
      {
        countId: 1,
        cameraId: 7,
        windowStart: '2026-10-12T10:00:00.000Z',
        inCount: 5,
        outCount: 1,
      },
    ]);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        CameraId: 7,
        WindowStart: {
          gte: new Date('2026-10-12T00:00:00Z'),
          lt: new Date('2026-10-13T00:00:00Z'),
        },
      },
    });
  });
});
