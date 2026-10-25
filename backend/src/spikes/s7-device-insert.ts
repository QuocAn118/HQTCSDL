import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env');
  const e = process.env;
  const p = new PrismaClient({
    adapter: new PrismaMssql({
      server: e.DB_SERVER!,
      port: Number(e.DB_PORT),
      database: e.DB_NAME!,
      user: e.DB_USER!,
      password: e.DB_PASSWORD!,
      options: { encrypt: false, trustServerCertificate: true, useUTC: true },
    }),
  });
  const zone = await p.zones.findFirstOrThrow();
  const rows = await p.$queryRaw<{ DeviceId: number }[]>`
    DECLARE @t TABLE (DeviceId INT);
    INSERT INTO dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
    OUTPUT INSERTED.DeviceId INTO @t
    VALUES (${zone.ZoneId}, ${'SPIKE-S7-FAN'}, ${'Spike S7'}, ${'FAN'}, ${'AUTO'}, ${false}, ${0});
    SELECT DeviceId FROM @t;`;
  console.log('S7 insert tra ve', rows);
  await p.$executeRaw`DELETE FROM dbo.Devices WHERE Code = ${'SPIKE-S7-FAN'}`;
  await p.$disconnect();
}
main().catch((err: Error) => {
  console.error('S7 FAIL', err?.message);
  process.exit(1);
});
