import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { AppConfig } from '../config/config';
import { createPrisma } from './db.service';
import { SpService } from './sp';
import { sqlNumberOf } from './sql-errors';

// SpService tren CSDL that (SwiftletCare_Dev), chi SP doc hoac loi truoc khi ghi. Chay bang: npm run test:db
describe('SpService voi CSDL that', () => {
  const e = parseEnv(readFileSync('.env', 'utf8'));
  const prisma = createPrisma({
    db: {
      server: e.DB_SERVER!,
      port: Number(e.DB_PORT),
      database: e.DB_NAME!,
      user: e.DB_USER!,
      password: e.DB_PASSWORD!,
    },
  } as AppConfig);
  const sp = new SpService({ prisma } as never);
  afterAll(() => prisma.$disconnect());

  it('readingHistory: tham so @P1..@P5 duoc gan dung, tra bucket', async () => {
    const [{ ZoneId }] = await prisma.$queryRawUnsafe<{ ZoneId: number }[]>(
      'SELECT TOP 1 ZoneId FROM dbo.Zones ORDER BY ZoneId',
    );
    const rows = await sp.readingHistory(
      ZoneId,
      'TEMP',
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-13T00:00:00Z'),
      60,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toEqual(
      expect.arrayContaining(['BucketUtc', 'AvgValue', 'MinValue', 'MaxValue']),
    );
  });

  it('reportEnvVsYield: ngay VN dang chuoi YYYY-MM-DD', async () => {
    const [{ HouseId }] = await prisma.$queryRawUnsafe<{ HouseId: number }[]>(
      "SELECT HouseId FROM dbo.Houses WHERE Name = 'H1'",
    );
    const rows = await sp.reportEnvVsYield(HouseId, '2026-10-01', '2026-10-31');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('ingestReadings JSON khong phai mang -> loi 50030 (SP tu choi truoc khi ghi)', async () => {
    const err = await sp.ingestReadings({} as never).catch((x: unknown) => x);
    expect(sqlNumberOf(err)).toBe(50030);
  });

  it('updateAlertStatus id khong ton tai -> loi 50020', async () => {
    const err = await sp
      .updateAlertStatus(-1, 'ACK', 1, null)
      .catch((x: unknown) => x);
    expect(sqlNumberOf(err)).toBe(50020);
  });
});
