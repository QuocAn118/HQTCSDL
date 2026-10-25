import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { DbHealth } from '../common/errors';
import { retryDelay, sleep, withTimeout } from '../common/async';
import { PrismaClient } from './prisma-client';
import { isConnectionError, isDbConfigError, sqlNumberOf } from './sql-errors';

export const PRISMA_FACTORY = 'PRISMA_FACTORY';
export const EXIT = 'EXIT';

export function createPrisma(cfg: AppConfig): PrismaClient {
  // Truyen tung thanh phan, khong tu ghep chuoi ket noi (mat khau co the co ky tu dac biet); useUTC co dinh (R6).
  const adapter = new PrismaMssql({
    server: cfg.db.server,
    port: cfg.db.port,
    database: cfg.db.database,
    user: cfg.db.user,
    password: cfg.db.password,
    options: { encrypt: false, trustServerCertificate: true, useUTC: true },
  });
  return new PrismaClient({ adapter });
}

const CONFIG_HINT: Record<number, string> = {
  18456: 'dang nhap SQL Server bi tu choi, kiem tra DB_USER/DB_PASSWORD',
  4060: 'CSDL khong ton tai hoac khong co quyen, kiem tra DB_NAME',
};

@Injectable()
export class DbService implements DbHealth, OnModuleDestroy {
  private log: Pick<Logger, 'log' | 'warn' | 'error'> = new Logger('CSDL');
  private client: PrismaClient;
  private ready = false;
  private connecting = false;
  private stopped = false;
  private configFailures = 0;
  private lastPing: { at: number; ok: boolean } | null = null;
  private readonly loaders: Array<{ name: string; fn: () => Promise<void> }> =
    [];

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional()
    @Inject(PRISMA_FACTORY)
    private readonly factory: (cfg: AppConfig) => PrismaClient = createPrisma,
    @Optional()
    @Inject(EXIT)
    private readonly exit: (code: number) => void = (code) =>
      process.exit(code),
  ) {
    this.client = this.factory(cfg);
  }

  get prisma(): PrismaClient {
    return this.client;
  }
  isReady(): boolean {
    return this.ready;
  }
  addLoader(name: string, fn: () => Promise<void>): void {
    this.loaders.push({ name, fn });
  }

  start(): void {
    if (this.connecting || this.stopped) return;
    this.connecting = true;
    void this.connectLoop().finally(() => {
      this.connecting = false;
    });
  }

  reportFailure(err: unknown): void {
    if (!this.ready || !isConnectionError(err)) return;
    this.ready = false;
    this.lastPing = null;
    this.log.warn('Mat ket noi CSDL, dang ket noi lai');
    const old = this.client;
    void old.$disconnect().catch(() => undefined);
    this.client = this.factory(this.cfg); // S5: tao lai client cho chac chan sau RESTORE / khoi dong lai SQL Server
    this.start();
  }

  async ping(): Promise<boolean> {
    if (!this.ready) return false;
    if (this.lastPing && Date.now() - this.lastPing.at < 5000)
      return this.lastPing.ok;
    try {
      await this.client.$queryRawUnsafe('SELECT 1 AS ok');
      this.lastPing = { at: Date.now(), ok: true };
    } catch (e) {
      this.lastPing = { at: Date.now(), ok: false };
      this.reportFailure(e);
    }
    return this.lastPing?.ok ?? false;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.client.$disconnect().catch(() => undefined);
  }

  private async connectLoop(): Promise<void> {
    let attempt = 0;
    let lastState = '';
    while (!this.stopped) {
      try {
        await withTimeout(
          this.client.$queryRawUnsafe('SELECT 1 AS ok'),
          10000,
          'SELECT 1',
        );
        for (const l of this.loaders)
          await withTimeout(l.fn(), 10000, `nap ${l.name}`);
        this.ready = true;
        this.configFailures = 0;
        this.log.log('CSDL san sang (da nap bo nho dem)');
        return;
      } catch (e) {
        const n = sqlNumberOf(e);
        if (isDbConfigError(n)) {
          this.configFailures += 1;
          this.log.error(
            `Cau hinh CSDL sai (lan ${this.configFailures}/5): ${CONFIG_HINT[n as number]}`,
          );
          if (this.configFailures >= 5) {
            this.exit(1);
            return;
          }
        } else {
          this.configFailures = 0;
          const state = (e as Error)?.message?.startsWith('timeout')
            ? 'qua han'
            : 'chua san sang';
          if (state !== lastState)
            this.log.warn(
              `CSDL ${state}, thu lai theo lich 1, 2, 5, 10, 30 giay`,
            );
          lastState = state;
        }
      }
      await sleep(retryDelay(attempt++));
    }
  }
}
