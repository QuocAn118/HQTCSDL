import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { retryDelay, sleep } from '../common/async';
import * as pick from '../common/pickers';
import { CLOCK, ControlCache } from '../control-loop/cache.service';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { IngestResult, ReadingItem, SpService } from '../db/sp';
import { isConnectionError, sqlNumberOf } from '../db/sql-errors';
import { RealtimeService } from '../realtime/realtime.service';
import {
  BATCH_SIZE,
  NO_RETRY,
  RejectReason,
  UNKNOWN_RETRY_MS,
  validateReadings,
} from './ingest';
import { MqttService } from './mqtt.service';

@Injectable()
export class IngestService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Thu nhan');
  private queue: ReadingItem[] = [];
  private busy = false;
  private nextAt = 0;
  private retryAttempt = 0;
  private unknownFailures = 0;
  private failing = false;
  private timer: NodeJS.Timeout | null = null;
  private rejects = new Map<RejectReason, { count: number; example: string }>();

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly cache: ControlCache,
    private readonly loop: ControlLoopService,
    private readonly rt: RealtimeService,
    private readonly mqtt: MqttService,
    @Optional()
    @Inject(CLOCK)
    private readonly clock: () => Date = () => new Date(),
  ) {}

  onModuleInit(): void {
    this.mqtt.onReadings((code, payload) => this.receive(code, payload));
    this.timer = setInterval(() => void this.tick(), 1000); // gom lo moi 1 giay (hop dong 2.3)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  queueLength(): number {
    return this.queue.length;
  }

  receive(code: string, payload: Buffer): void {
    const { items, rejected } = validateReadings(code, payload);
    for (const r of rejected) {
      const cur = this.rejects.get(r.reason);
      this.rejects.set(r.reason, {
        count: (cur?.count ?? 0) + 1,
        example: cur?.example ?? r.example,
      });
    }
    this.queue.push(...items);
    const excess = this.queue.length - this.cfg.ingestRetryMaxItems;
    if (excess > 0) {
      this.queue.splice(0, excess);
      this.log.warn(
        `Hang cho vuot INGEST_RETRY_MAX_ITEMS: bo ${excess} so do cu nhat`,
      );
    }
    if (this.queue.length >= BATCH_SIZE) void this.tick();
  }

  async tick(): Promise<void> {
    this.flushRejectLog();
    if (this.busy || !this.db.isReady() || this.clock().getTime() < this.nextAt)
      return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, BATCH_SIZE);
        let res: IngestResult;
        try {
          res = await this.sp.ingestReadings(batch);
        } catch (e) {
          this.onFailure(e, batch.length);
          return;
        }
        this.queue.splice(0, batch.length);
        if (this.failing) this.log.log('Ghi so do da hoi phuc');
        this.failing = false;
        this.retryAttempt = 0;
        this.unknownFailures = 0;
        this.nextAt = 0;
        await this.afterSuccess(res);
      }
    } finally {
      this.busy = false;
    }
  }

  async flush(timeoutMs: number): Promise<number> {
    if (!this.db.isReady()) return this.queue.length; // CSDL dang loi: khong cho (spec backend 3.6)
    const end = Date.now() + timeoutMs;
    this.nextAt = 0;
    while (this.queue.length && Date.now() < end) {
      await this.tick();
      if (this.queue.length && this.failing) break;
      // tick() tra ve ngay khi dang ban/cho nextAt: nhuong event loop de lo dang ghi xong.
      if (this.queue.length) await sleep(10);
    }
    return this.queue.length;
  }

  async emitResolved(ids: number[]): Promise<void> {
    if (!ids.length) return;
    // SP chi tra AlertId -> doc dong canh bao lay houseId, status, resolvedAt, resolvedBy (spec backend 4.2).
    const rows = await this.db.prisma.alerts.findMany({
      where: { AlertId: { in: ids } },
      select: {
        AlertId: true,
        HouseId: true,
        Status: true,
        ResolvedAt: true,
        ResolvedBy: true,
      },
    });
    for (const a of rows)
      this.rt.emitToHouse(a.HouseId, 'alert.updated', {
        alertId: a.AlertId,
        houseId: a.HouseId,
        status: a.Status,
        resolvedAt: a.ResolvedAt,
        resolvedBy: a.ResolvedBy,
      });
  }

  private onFailure(e: unknown, size: number): void {
    const n = sqlNumberOf(e);
    const now = this.clock().getTime();
    if (
      isConnectionError(e) ||
      n === 1205 ||
      (e as Error)?.message?.startsWith('timeout')
    ) {
      if (!this.failing)
        this.log.warn(
          'Ghi so do loi (mat ket noi/het thoi gian/1205), giu lo va thu lai',
        );
      this.failing = true;
      this.nextAt = now + retryDelay(this.retryAttempt++);
      this.db.reportFailure(e);
      return;
    }
    if (n !== null && NO_RETRY.includes(n)) {
      this.dropHead(size, `loi ${n}, khong thu lai`);
      return;
    }
    this.unknownFailures += 1;
    if (this.unknownFailures > UNKNOWN_RETRY_MS.length) {
      this.dropHead(
        size,
        `loi chua biet sau ${UNKNOWN_RETRY_MS.length} lan thu lai: ${(e as Error)?.message ?? n}`,
      );
      this.unknownFailures = 0;
      return;
    }
    this.nextAt = now + UNKNOWN_RETRY_MS[this.unknownFailures - 1];
  }

  private dropHead(size: number, why: string): void {
    const first = this.queue[0];
    this.queue.splice(0, size);
    this.nextAt = 0;
    this.log.error(
      `Bo lo ${size} so do (${why}); phan tu dau: ${JSON.stringify(first)}`,
    );
  }

  // Moi buoc tu bat loi: loi buoc nay khong lam bo qua buoc sau (spec backend 4.2).
  private async afterSuccess(res: IngestResult): Promise<void> {
    const step = async (name: string, fn: () => unknown) => {
      try {
        await fn();
      } catch (e) {
        this.log.error(
          `Sau ghi so do, buoc ${name} loi: ${(e as Error).message}`,
        );
      }
    };
    await step('bo nho dem', () => this.cache.applyReadings(res.acceptedRows));
    await step('readings.new', () => {
      const byHouse = new Map<number, unknown[]>();
      for (const r of res.acceptedRows)
        byHouse.set(r.HouseId, [
          ...(byHouse.get(r.HouseId) ?? []),
          pick.readingEvent(r as never),
        ]);
      for (const [houseId, readings] of byHouse)
        this.rt.emitToHouse(houseId, 'readings.new', { houseId, readings });
    });
    await step('alert.created', () => {
      for (const a of res.newAlerts)
        this.rt.emitToHouse(Number(a.HouseId), 'alert.created', {
          alert: pick.alertFromSp(a),
        });
    });
    await step('alert.updated', () => this.emitResolved(res.resolvedAlertIds));
    await step('vong dieu khien', () => {
      // Khong cho vong dieu khien xong, nhung van bat loi cua no (khong de unhandled rejection).
      this.loop
        .runZones([...new Set(res.acceptedRows.map((r) => r.ZoneId))])
        .catch((e: Error) =>
          this.log.error(
            `Sau ghi so do, buoc vong dieu khien loi: ${e.message}`,
          ),
        );
    });
    if (res.rejected > 0 || res.duplicates > 0)
      this.log.warn(
        `Lo so do: ${res.rejected} bi SP loai, ${res.duplicates} trung`,
      );
  }

  // Mot dong log gop moi nhip (spec backend 4.1).
  private flushRejectLog(): void {
    if (!this.rejects.size) return;
    const parts = [...this.rejects].map(
      ([r, v]) => `${r} x${v.count} (vd ${v.example})`,
    );
    this.log.warn(`Bo phan tu so do: ${parts.join('; ')}`);
    this.rejects.clear();
  }
}
