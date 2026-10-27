/* eslint-disable @typescript-eslint/require-await -- gia lap SP/Prisma async; mock.calls cua jest.fn la any */
import { validateDto } from '../common/validation';
import { HistoryQuery, VnRangeQuery } from './dto';
import { ReadingsController } from './readings.controller';

describe('HistoryQuery', () => {
  it('from thieu Z -> fields [from]; bucketMinutes mac dinh 60, khong chan <= 0 (SP bao 50040)', async () => {
    await expect(
      validateDto(HistoryQuery, {
        metric: 'TEMP',
        from: '2026-10-12T09:40:07',
        to: '2026-10-12T10:41:07Z',
      }),
    ).rejects.toMatchObject({ details: { fields: ['from'] } });
    const q = await validateDto(HistoryQuery, {
      metric: 'TEMP',
      from: '2026-10-12T09:41:07Z',
      to: '2026-10-12T10:41:07Z',
    });
    expect(q.bucketMinutes).toBe(60);
    await expect(
      validateDto(HistoryQuery, {
        metric: 'TEMP',
        from: '2026-10-12T09:41:07Z',
        to: '2026-10-12T10:41:07Z',
        bucketMinutes: '0',
      }),
    ).resolves.toMatchObject({ bucketMinutes: 0 });
  });
});

describe('ReadingsController', () => {
  const sp = {
    readingHistory: jest.fn(async () => [
      {
        BucketUtc: new Date(Date.UTC(2026, 9, 12, 9, 41, 7)),
        AvgValue: 31.2,
        MinValue: 31.2,
        MaxValue: 31.2,
      },
    ]),
  };
  const db = { prisma: { $queryRawUnsafe: jest.fn(async () => []) } };
  const c = new ReadingsController(sp as never, db as never);

  it('lich su: doi chuoi thanh Date, tra bucketUtc...Z', async () => {
    const r = await c.history(10, {
      metric: 'TEMP',
      from: '2026-10-12T09:41:07Z',
      to: '2026-10-12T10:41:07Z',
      bucketMinutes: 60,
    });
    expect(sp.readingHistory).toHaveBeenCalledWith(
      10,
      'TEMP',
      new Date('2026-10-12T09:41:07Z'),
      new Date('2026-10-12T10:41:07Z'),
      60,
    );
    expect(r).toEqual([
      {
        bucketUtc: '2026-10-12T09:41:07.000Z',
        avgValue: 31.2,
        minValue: 31.2,
        maxValue: 31.2,
      },
    ]);
  });

  it('thong ke ngay: from >= to -> 400 fields [toVnDate]; nua mo [from, to)', async () => {
    await expect(
      c.dailyStats(10, { fromVnDate: '2026-10-12', toVnDate: '2026-10-12' }),
    ).rejects.toMatchObject({ status: 400, details: { fields: ['toVnDate'] } });
    await c.dailyStats(10, {
      fromVnDate: '2026-10-05',
      toVnDate: '2026-10-13',
    });
    const [sql, ...params] = db.prisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toMatch(/DayVn >= @P2 AND DayVn < @P3/);
    expect(params).toEqual([10, '2026-10-05', '2026-10-13']);
  });

  it('VnRangeQuery tu choi dang ngay khac YYYY-MM-DD', async () => {
    await expect(
      validateDto(VnRangeQuery, {
        fromVnDate: '12/10/2026',
        toVnDate: '2026-10-13',
      }),
    ).rejects.toMatchObject({ details: { fields: ['fromVnDate'] } });
  });
});
