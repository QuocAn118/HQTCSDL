import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isUtcIso } from '../common/validation';
import { DbService } from '../db/db.service';
import { HeartbeatItem, SpService } from '../db/sp';
import { IngestService } from './ingest.service';
import { MqttService } from './mqtt.service';

export function validateHeartbeat(
  code: string,
  payload: Buffer,
): HeartbeatItem | null {
  try {
    const p = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    return p &&
      typeof p === 'object' &&
      !Array.isArray(p) &&
      p.device === code &&
      isUtcIso(p.at)
      ? { device: code, at: p.at as string }
      : null;
  } catch {
    return null;
  }
}

// Hang cho rieng, cung nhip 1 giay; loi thi bo, khong thu lai (mat mot nhip vo hai, hop dong 2.2).
@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Heartbeat');
  private queue: HeartbeatItem[] = [];
  private busy = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly ingest: IngestService,
    private readonly mqtt: MqttService,
  ) {}

  onModuleInit(): void {
    // Dang ky truoc MqttService.start() (main.ts) -> lan ket noi dau da subscribe heartbeat.
    this.mqtt.onHeartbeat((code, payload) => this.receive(code, payload));
    this.timer = setInterval(() => this.tickInBackground(), 1000);
  }

  private tickInBackground(): void {
    this.tick().catch((e: Error) =>
      this.log.error(`Nhip heartbeat loi: ${e.message}`),
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  receive(code: string, payload: Buffer): void {
    const item = validateHeartbeat(code, payload);
    if (item) this.queue.push(item);
  }

  async tick(): Promise<void> {
    if (this.busy || !this.queue.length || !this.db.isReady()) return;
    this.busy = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const r = await this.sp.recordHeartbeat(batch);
      await this.ingest.emitResolved(r.resolvedAlertIds);
    } catch (e) {
      this.log.warn(`Bo ${batch.length} heartbeat: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }
}
