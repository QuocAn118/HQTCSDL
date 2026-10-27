import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { withTimeout } from '../common/async';
import { DbService } from '../db/db.service';
import { ActuatorResult, SetActuatorArgs, SpService } from '../db/sp';
import { sqlNumberOf } from '../db/sql-errors';
import { MqttService } from '../mqtt/mqtt.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CLOCK, ControlCache } from './cache.service';
import { decide } from './rules';

export const COMMAND_TIMEOUT_MS = 5000;
export const RESYNC_MIN_GAP_MS = 5000;

@Injectable()
export class ControlLoopService implements OnModuleInit {
  private readonly log = new Logger('Dieu khien');
  private chain: Promise<unknown> = Promise.resolve();
  private lastResync = 0;
  private resyncTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cache: ControlCache,
    private readonly sp: SpService,
    private readonly mqtt: MqttService,
    private readonly rt: RealtimeService,
    private readonly db: DbService,
    @Optional()
    @Inject(CLOCK)
    private readonly clock: () => Date = () => new Date(),
  ) {}

  onModuleInit(): void {
    this.db.addLoader('bo nho dem', () => this.cache.load());
    this.mqtt.onConnect(() => this.requestResync());
  }

  // Mot hang doi tuan tu duy nhat: hai lan chay khong chong nhau (spec backend 4.4).
  runZones(zoneIds: number[]): Promise<void> {
    return this.enqueue(() => this.runOnce([...new Set(zoneIds)]));
  }

  // Dieu khien tay di qua cung hang doi: bo nho dem luon khop ket qua SP sau cung (Review Focus 5).
  executeManual(a: SetActuatorArgs): Promise<ActuatorResult> {
    return this.enqueue(() => this.execute(a));
  }

  requestResync(): void {
    if (this.resyncTimer) return;
    const wait = Math.max(
      0,
      this.lastResync + RESYNC_MIN_GAP_MS - this.clock().getTime(),
    );
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null;
      if (!this.cache.isLoaded()) {
        setTimeout(() => this.requestResync(), 1000);
        return;
      }
      this.lastResync = this.clock().getTime();
      void this.resync();
    }, wait);
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async runOnce(zoneIds: number[]): Promise<void> {
    for (const zoneId of zoneIds) {
      const input = this.cache.zoneInput(zoneId, this.clock());
      if (!input) continue;
      const { commands, latches } = decide(input);
      this.cache.setLatches(zoneId, latches);
      for (const c of commands) {
        try {
          await this.execute({
            deviceId: c.deviceId,
            isOn: c.isOn,
            level: c.level,
            source: 'AUTO',
            mode: null,
            userId: null,
            reason: c.reason,
          });
        } catch (e) {
          if (sqlNumberOf(e) === 50003) {
            this.cache.removeDevice(c.deviceId);
            this.log.warn(
              `Thiet bi ${c.deviceId} khong dieu khien duoc (50003), bo khoi bo nho dem`,
            );
          } else {
            this.log.error(
              `Lenh tu dong cho thiet bi ${c.deviceId} loi: ${(e as Error).message}`,
            );
          }
        }
      }
    }
  }

  // Buoc thuc thi chung cho tay va tu dong (spec backend 4.4).
  private async execute(a: SetActuatorArgs): Promise<ActuatorResult> {
    const r = await withTimeout(
      this.sp.setActuator(a),
      COMMAND_TIMEOUT_MS,
      `sp_SetActuator ${a.deviceId}`,
    );
    this.cache.applyDeviceState(a.deviceId, {
      mode: r.mode,
      isOn: r.isOn,
      level: r.level,
    });
    if (r.changed) {
      try {
        await this.mqtt.publishCommand(r.deviceCode, {
          isOn: r.isOn,
          level: r.level,
          mode: r.mode,
        });
      } catch (e) {
        this.log.error(
          `Publish lenh ${r.deviceCode} loi: ${(e as Error).message}; dong bo lai khi MQTT ket noi lai`,
        );
      }
      const d = this.cache.device(a.deviceId);
      if (d) {
        this.rt.emitToHouse(d.houseId, 'device.state', {
          deviceId: a.deviceId,
          deviceCode: r.deviceCode,
          houseId: d.houseId,
          zoneId: d.zoneId,
          mode: r.mode,
          isOn: r.isOn,
          level: r.level,
          source: a.source,
          at: this.clock(),
        });
      }
    }
    return r;
  }

  private async resync(): Promise<void> {
    const list = this.cache.actuators();
    for (const d of list) {
      try {
        await this.mqtt.publishCommand(d.code, {
          isOn: d.isOn,
          level: d.level,
          mode: d.mode,
        });
      } catch (e) {
        this.log.warn(`Dong bo lenh ${d.code} loi: ${(e as Error).message}`);
      }
    }
    this.log.log(`Da publish lai trang thai ${list.length} co cau chap hanh`);
  }
}
