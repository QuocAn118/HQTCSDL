import { spawn } from 'node:child_process';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';
import { isConnectionError, mapSqlError, sqlNumberOf } from '../db/sql-errors';

const env = () => {
  process.loadEnvFile('.env');
  return process.env;
};

function client(over: Record<string, string> = {}): PrismaClient {
  const e = { ...env(), ...over };
  return new PrismaClient({
    adapter: new PrismaMssql({
      server: e.DB_SERVER!,
      port: Number(e.DB_PORT),
      database: e.DB_NAME!,
      user: e.DB_USER!,
      password: e.DB_PASSWORD!,
      options: { encrypt: false, trustServerCertificate: true, useUTC: true },
    }),
  });
}

// In moi thuoc tinh co ten number/code/kind/originalCode o moi tang (err, cause, meta, ...), bo qua chuoi dai.
function shape(
  err: unknown,
  path = 'err',
  seen = new Set<unknown>(),
): string[] {
  if (err === null || typeof err !== 'object' || seen.has(err)) return [];
  seen.add(err);
  const out: string[] = [`${path}: ${err.constructor?.name}`];
  for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
    if (
      ['number', 'code', 'kind', 'originalCode', 'name', 'errorCode'].includes(
        k,
      )
    )
      out.push(`${path}.${k} = ${JSON.stringify(v)}`);
    if (v && typeof v === 'object') out.push(...shape(v, `${path}.${k}`, seen));
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause) out.push(...shape(cause, `${path}.cause`, seen));
  return out;
}

function report(label: string, e: unknown): void {
  const n = sqlNumberOf(e);
  const mapped = n === null ? null : mapSqlError(n);
  console.log(
    `--- ${label}\nmessage: ${(e as Error).message?.slice(0, 200)}\n${shape(e).join('\n')}\n=> sqlNumberOf = ${n}; mapSqlError = ${mapped ? `${mapped.status} ${mapped.code}` : '-'}; isConnectionError = ${isConnectionError(e)}`,
  );
}

async function probe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`--- ${label}: KHONG LOI`);
  } catch (e) {
    report(label, e);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Rollback extends Error {}
const SQLCMD =
  'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/180/Tools/Binn/SQLCMD.EXE';

// 1205: giao dich Prisma khoa dong x roi xin dong y; phien sqlcmd (DEADLOCK_PRIORITY HIGH) khoa y roi xin x.
// Hai client Prisma trong cung tien trinh chay giao dich noi tiep nhau nen khong tu deadlock duoc. Ca hai deu rollback.
async function deadlock(): Promise<void> {
  const e = env();
  const p = client();
  const [x, y] = await p.$queryRaw<
    { ZoneId: number }[]
  >`SELECT TOP 2 ZoneId FROM dbo.Thresholds WHERE MetricCode = 'TEMP' ORDER BY ZoneId`.then(
    (r) => r.map((v) => v.ZoneId),
  );
  let other: ReturnType<typeof spawn> | undefined;
  try {
    await p.$transaction(
      async (t) => {
        await t.$executeRaw`UPDATE dbo.Thresholds SET TargetValue = TargetValue + 0.01 WHERE ZoneId = ${x} AND MetricCode = 'TEMP'`;
        other = spawn(
          SQLCMD,
          [
            '-S',
            `${e.DB_SERVER},${e.DB_PORT}`,
            '-U',
            e.DB_USER!,
            '-d',
            e.DB_NAME!,
            '-C',
            '-b',
            '-Q',
            `SET DEADLOCK_PRIORITY HIGH; SET XACT_ABORT ON; BEGIN TRAN; UPDATE dbo.Thresholds SET TargetValue = TargetValue + 0.01 WHERE ZoneId = ${y} AND MetricCode = 'TEMP'; WAITFOR DELAY '00:00:01'; UPDATE dbo.Thresholds SET TargetValue = TargetValue + 0.01 WHERE ZoneId = ${x} AND MetricCode = 'TEMP'; ROLLBACK;`,
          ],
          {
            env: { ...process.env, SQLCMDPASSWORD: e.DB_PASSWORD },
            stdio: 'ignore',
          },
        );
        await sleep(2000);
        await t.$executeRaw`UPDATE dbo.Thresholds SET TargetValue = TargetValue + 0.01 WHERE ZoneId = ${y} AND MetricCode = 'TEMP'`;
        throw new Rollback('rollback co chu dich');
      },
      { timeout: 20000, maxWait: 5000 },
    );
  } catch (err) {
    if (err instanceof Rollback)
      console.log(
        '--- 1205 deadlock: KHONG LOI (Prisma khong bi chon lam nan nhan)',
      );
    else report('1205 deadlock (Prisma la nan nhan)', err);
  }
  const code = await new Promise((r) =>
    other ? other.on('exit', r) : r('khong chay'),
  );
  console.log(`sqlcmd thoat ma ${String(code)}`);
  await p.$disconnect();
}

async function main(): Promise<void> {
  const p = client();
  await probe(
    '50030 sp_IngestReadings JSON sai ($queryRaw)',
    () => p.$queryRaw`EXEC dbo.sp_IngestReadings @Json = ${'khong-phai-json'}`,
  );
  await probe(
    '50030 sp_IngestReadings JSON sai ($executeRaw)',
    () => p.$executeRaw`EXEC dbo.sp_IngestReadings @Json = ${'{}'}`,
  );
  await probe(
    '50042 sp_IngestReadings @StaleMinutes = 0',
    () =>
      p.$queryRaw`EXEC dbo.sp_IngestReadings @Json = ${'[]'}, @StaleMinutes = ${0}`,
  );
  await probe(
    '50021 sp_UpdateAlertStatus',
    () =>
      p.$queryRaw`EXEC dbo.sp_UpdateAlertStatus @AlertId = ${-1}, @Status = ${'ACK'}, @UserId = ${1}`,
  );
  const t = await p.thresholds.findFirstOrThrow();
  await probe('547 CHECK qua Prisma update', () =>
    p.thresholds.update({
      where: {
        ZoneId_MetricCode: { ZoneId: t.ZoneId, MetricCode: t.MetricCode },
      },
      data: { MinValue: 31, MaxValue: 25 },
    }),
  );
  await probe(
    '547 CHECK qua $executeRaw',
    () =>
      p.$executeRaw`UPDATE dbo.Thresholds SET MinValue = 31, MaxValue = 25 WHERE ZoneId = ${t.ZoneId} AND MetricCode = ${t.MetricCode}`,
  );
  await probe(
    '547 FOREIGN KEY qua $executeRaw',
    () =>
      p.$executeRaw`UPDATE dbo.Thresholds SET ZoneId = -1 WHERE ZoneId = ${t.ZoneId} AND MetricCode = ${t.MetricCode}`,
  );
  await probe('2627 UNIQUE qua Prisma create', () =>
    p.users.create({
      data: {
        Username: 'owner1',
        PasswordHash: 'x',
        FullName: 'x',
        Email: 'dup-spike@x.local',
        Role: 'OWNER',
      },
    }),
  );
  await probe(
    '2627 UNIQUE qua $executeRaw (rollback)',
    () =>
      p.$executeRaw`SET XACT_ABORT ON; BEGIN TRAN; INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES ('owner1', 'x', N'x', 'dup-spike@x.local', 'OWNER'); ROLLBACK;`,
  );
  await probe(
    '2601 chi muc UX_Alerts_OpenThreshold (rollback)',
    () => p.$executeRaw`SET XACT_ABORT ON; BEGIN TRAN;
    DECLARE @z INT, @h INT; SELECT TOP 1 @z = ZoneId, @h = HouseId FROM dbo.Zones ORDER BY ZoneId;
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message) VALUES (@h, @z, 'THRESHOLD', 'WARNING', 'CO2', 9999, N'spike s6');
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message) VALUES (@h, @z, 'THRESHOLD', 'WARNING', 'CO2', 9999, N'spike s6');
    ROLLBACK;`,
  );
  await p.$disconnect();
  await deadlock();
  await probe(
    '18456 sai mat khau',
    () => client({ DB_PASSWORD: 'sai-mat-khau-cho-spike' }).$queryRaw`SELECT 1`,
  );
  await probe(
    '4060 CSDL khong ton tai',
    () => client({ DB_NAME: 'KhongTonTai_Spike' }).$queryRaw`SELECT 1`,
  );
  await probe(
    'khong ket noi duoc (cong 1)',
    () => client({ DB_PORT: '1' }).$queryRaw`SELECT 1`,
  );
}
void main();
