import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import { sleep, withTimeout } from '../common/async';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import type { SpAlert } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';

export const TICK_MS = 60_000;
export const CALL_TIMEOUT_MS = 30_000; // S10 tren Dev: 0,5-3,5 s -> giu 30 s
export const ADMIN_WAIT_MS = 10_000;
export const ADMIN_OFFLINE_MINUTES = 525_600; // 1 nam: chi phan sut dan (spec backend 5.8)

@Injectable()
export class AnomalyService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Bat thuong');
  private running = false;
  private skipping = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly rt: RealtimeService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (this.cfg.anomalyScheduler)
      this.registry.addInterval(
        'detect-anomalies',
        setInterval(() => {
          this.tick().catch((e: Error) =>
            this.log.error(`Nhip loi: ${e.message}`),
          );
        }, TICK_MS),
      );
  }

  onModuleDestroy(): void {
    this.stop();
  }

  stop(): void {
    try {
      if (this.registry.doesExist('interval', 'detect-anomalies'))
        this.registry.deleteInterval('detect-anomalies');
    } catch {
      /* chua dang ky */
    }
  }

  async tick(): Promise<void> {
    if (!this.db.isReady()) return;
    if (this.running) {
      if (!this.skipping)
        this.log.warn('Luot truoc chua xong, bat dau bo luot');
      this.skipping = true;
      return;
    }
    if (this.skipping) this.log.log('Het bo luot');
    this.skipping = false;
    try {
      await this.run({});
    } catch (e) {
      this.log.error(`sp_DetectAnomalies loi: ${(e as Error).message}`);
    }
  }

  // Dung chung khoa voi nhip nen: cho toi da 10 giay, qua thi 503 (spec backend 5.8).
  async detectNow(nowUtc: Date): Promise<object[]> {
    const end = Date.now() + ADMIN_WAIT_MS;
    while (this.running) {
      if (Date.now() >= end) throw new ApiError(503, 'RETRY_LATER');
      await sleep(100);
    }
    return this.run({ nowUtc, offlineMinutes: ADMIN_OFFLINE_MINUTES });
  }

  private async run(opts: {
    nowUtc?: Date;
    offlineMinutes?: number;
  }): Promise<object[]> {
    this.running = true;
    try {
      const alerts: SpAlert[] = await withTimeout(
        this.sp.detectAnomalies(opts),
        CALL_TIMEOUT_MS,
        'sp_DetectAnomalies',
      );
      const out = alerts.map((a) => pick.alertFromSp(a));
      // NewAlertsJson da gom DEVICE_OFFLINE do trigger tao: chi phat lai (spec backend 6.4).
      for (const a of out)
        this.rt.emitToHouse(Number(a.houseId), 'alert.created', { alert: a });
      return out;
    } finally {
      this.running = false;
    }
  }
}
