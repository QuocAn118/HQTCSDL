import { compareSync } from 'bcryptjs';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../db/prisma-client';

async function main(): Promise<void> {
  process.loadEnvFile('.env.test');
  const e = process.env;
  const prisma = new PrismaClient({
    adapter: new PrismaMssql({
      server: e.DB_SERVER!,
      port: Number(e.DB_PORT),
      database: 'SwiftletCare_Dev',
      user: e.DB_USER!,
      password: e.DB_PASSWORD!,
      options: { encrypt: false, trustServerCertificate: true, useUTC: true },
    }),
  });
  const u = await prisma.users.findUniqueOrThrow({
    where: { Username: 'owner1' },
  });
  console.log(
    'S4 prefix',
    u.PasswordHash.slice(0, 7),
    'compare',
    compareSync(e.DEV_SEED_PASSWORD!, u.PasswordHash),
  );
  await prisma.$disconnect();
}
main().catch((err: Error) => {
  console.error('S4 FAIL', err?.message);
  process.exit(1);
});
