
import 'dotenv/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaMssql({
  server: process.env.DB_SERVER!,
  port: Number(process.env.DB_PORT),
  database: 'SwiftletCare_Dev',
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    useUTC: true,
  },
});

const prisma = new PrismaClient({ adapter });

const AT = '2026-10-13T10:00:07Z';

async function main() {
  const json = JSON.stringify([
    {
      device: 'H1-F1-SENSOR',
      metric: 'TEMP',
      value: 28.5,
      at: AT,
    },
  ]);

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    EXEC dbo.sp_IngestReadings @Json = ${json}
  `;

  console.log('R3/R6 ket qua SP:', rows);

  const two = await prisma.$queryRawUnsafe<
    Record<string, unknown>[]
  >('SELECT 1 AS a; SELECT 2 AS b;');

  console.log('R3 hai tap ket qua ->', JSON.stringify(two));

  const r = await prisma.sensorReadings.findFirstOrThrow({
    where: {
      Device: { Code: 'H1-F1-SENSOR' },
      MetricCode: 'TEMP',
      RecordedAt: new Date(AT),
    },
  });

  const iso = r.RecordedAt.toISOString();

  console.log(
    `R6 doc lai: ${iso} -> ${
      iso === '2026-10-13T10:00:07.000Z' ? 'DUNG' : 'LECH'
    }`
  );

  console.log(
    `Decimal: ${r.Value.constructor.name}`,
    JSON.stringify({ v: r.Value })
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
