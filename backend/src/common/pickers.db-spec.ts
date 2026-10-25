import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';
import * as pickers from './pickers';

// Test cham CSDL that (SwiftletCare_Dev da co du lieu mau), doc backend/.env. Chay bang: npm run test:db

type Row = Record<string, unknown>;

// Cac cot PascalCase ma picker doc tu dong (ghi lai qua Proxy), khong can phan tich ma nguon.
function columnsRead(pick: (r: Row) => unknown): string[] {
  const read = new Set<string>();
  const spy = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (typeof k === 'string' && /^[A-Z]/.test(k)) read.add(k);
        return null;
      },
    },
  );
  pick(spy);
  return [...read];
}

describe('pickers so voi cot that cua CSDL', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // process.loadEnvFile ghi vao process.env that, jest cho test mot ban sao -> doc file truc tiep.
    const e = parseEnv(readFileSync('.env', 'utf8'));
    prisma = new PrismaClient({
      adapter: new PrismaMssql({
        server: e.DB_SERVER!,
        port: Number(e.DB_PORT),
        database: e.DB_NAME!,
        user: e.DB_USER!,
        password: e.DB_PASSWORD!,
        options: { encrypt: false, trustServerCertificate: true, useUTC: true },
      }),
    });
  });
  afterAll(() => prisma.$disconnect());

  it.each([
    ['user', 'SELECT TOP 1 * FROM dbo.Users'],
    ['house', 'SELECT TOP 1 * FROM dbo.Houses'],
    ['zone', 'SELECT TOP 1 * FROM dbo.Zones'],
    ['device', 'SELECT TOP 1 * FROM dbo.Devices'],
    ['metric', 'SELECT TOP 1 * FROM dbo.Metrics'],
    ['threshold', 'SELECT TOP 1 * FROM dbo.Thresholds'],
    ['latestReading', 'SELECT TOP 1 * FROM dbo.vw_LatestReadings'],
    ['dailyStats', 'SELECT TOP 1 * FROM dbo.vw_DailyEnvStats'],
    ['birdFlow', 'SELECT TOP 1 * FROM dbo.vw_DailyBirdFlow'],
    ['birdCount', 'SELECT TOP 1 * FROM dbo.BirdCounts'],
    ['alert', 'SELECT TOP 1 * FROM dbo.Alerts'],
    ['alertFromSp', 'SELECT TOP 1 * FROM dbo.vw_AlertJson'],
  ] as const)('%s: moi cot picker doc deu co trong %s', async (name, sql) => {
    const rows = await prisma.$queryRawUnsafe<Row[]>(sql);
    expect(rows.length).toBe(1); // du lieu mau phai co, neu khong test khong chung minh gi
    const pick = pickers[name];
    const missing = columnsRead(pick).filter((c) => !(c in rows[0]));
    expect(missing).toEqual([]);
    expect(Object.values(pick(rows[0]))).not.toContain(undefined);
  });
});
