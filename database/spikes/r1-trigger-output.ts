
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

const prisma = new PrismaClient({
  adapter,
  log: ['query'],
});

async function attempt(
  label: string,
  fn: () => Promise<unknown>
) {
  try {
    await fn();
    console.log(`R1 ${label}: OK`);
  } catch (e) {
    console.log(`R1 ${label}: LOI -> ${(e as Error).message}`);
  }
}

async function main() {
  await prisma.$executeRawUnsafe(
    `CREATE OR ALTER TRIGGER dbo.trg_R1Probe
     ON dbo.Devices AFTER UPDATE AS
     BEGIN
       SET NOCOUNT ON;
     END`
  );

  const zone = await prisma.zones.findFirstOrThrow({
    where: {
      Name: 'F1',
      House: { Name: 'H1' },
    },
  });

  try {
    await attempt('create (bang co trigger AFTER UPDATE)', () =>
      prisma.devices.create({
        data: {
          ZoneId: zone.ZoneId,
          Code: 'R1-PROBE',
          Name: 'R1 probe',
          DeviceType: 'SENSOR',
        },
      })
    );

    await attempt('update (bang co trigger AFTER UPDATE)', () =>
      prisma.devices.update({
        where: { Code: 'H1-F1-SENSOR' },
        data: { Name: 'R1 probe update' },
      })
    );

    await attempt('$executeRaw UPDATE khong OUTPUT', () =>
      prisma.$executeRaw`
        UPDATE dbo.Devices
        SET Name = ${'R1 raw update'}
        WHERE Code = ${'H1-F1-SENSOR'}
      `
    );
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS dbo.trg_R1Probe`
    );

    await prisma.$executeRaw`
      DELETE FROM dbo.Devices
      WHERE Code = ${'R1-PROBE'}
    `;

    await prisma.$executeRaw`
      UPDATE dbo.Devices
      SET Name = ${'Cảm biến H1 tầng 1'}
      WHERE Code = ${'H1-F1-SENSOR'}
    `;

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
