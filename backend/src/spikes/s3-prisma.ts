import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env');
  const adapter = new PrismaMssql({
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: { encrypt: false, trustServerCertificate: true, useUTC: true },
  });
  const prisma = new PrismaClient({ adapter });
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  const users = await prisma.users.count();
  console.log('S3 OK', rows[0].ok, 'users =', users);
  await prisma.$disconnect();
}
main().catch((e: Error) => {
  console.error('S3 FAIL', e?.constructor?.name, e?.message);
  process.exit(1);
});
