import { Inject, Injectable, Optional } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AcceptedRow } from '../db/sp';
import {
  ActuatorType,
  Bounds,
  Latches,
  Metric,
  Reading,
  ZoneInput,
  initLatches,
} from './rules';

export const STALE_MINUTES = 2; // = @StaleMinutes mac dinh cua sp_IngestReadings
export const CLOCK = 'CLOCK';
const ACTUATORS = ['FAN', 'MIST', 'HEATER', 'SPEAKER'];
const RULE_DEVICES: string[] = ['FAN', 'MIST', 'HEATER'];

export interface DeviceEntry {
  deviceId: number;
  code: string;
  zoneId: number;
  houseId: number;
  deviceType: 'FAN' | 'MIST' | 'HEATER' | 'SPEAKER';
  mode: 'AUTO' | 'MANUAL';
  isOn: boolean;
  level: number | null;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);
const toEntry = (d: Row & { Zone: { HouseId: number } }): DeviceEntry => ({
  deviceId: d.DeviceId as number,
  code: d.Code as string,
  zoneId: d.ZoneId as number,
  houseId: d.Zone.HouseId,
  deviceType: d.DeviceType as DeviceEntry['deviceType'],
  mode: d.Mode as 'AUTO' | 'MANUAL',
  isOn: Boolean(d.IsOn),
  level: num(d.Level),
});

// Mot tien trinh, mot backend (han che 7, 9). Trang thai thiet bi chi cap nhat tu ket qua sp_SetActuator (spec 3.1).
@Injectable()
export class ControlCache {
  private loaded = false;
  private zoneHouse = new Map<number, number>();
  private hysteresis = new Map<string, number>();
  private bounds = new Map<number, Partial<Record<Metric, Bounds>>>();
  private devices = new Map<number, DeviceEntry>();
  private latches = new Map<number, Latches>();
  private readonly latest = new Map<number, Partial<Record<Metric, Reading>>>();

  constructor(
    private readonly db: DbService,
    @Optional()
    @Inject(CLOCK)
    private readonly clock: () => Date = () => new Date(),
  ) {}

  isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<void> {
    const p = this.db.prisma;
    const metrics = await p.metrics.findMany();
    const zones = await p.zones.findMany({
      where: { House: { IsActive: true } },
      select: { ZoneId: true, HouseId: true },
    });
    const zoneIds = zones.map((z) => z.ZoneId);
    const thresholds = await p.thresholds.findMany({
      where: { ZoneId: { in: zoneIds } },
    });
    const devices = await p.devices.findMany({
      where: {
        IsActive: true,
        DeviceType: { in: ACTUATORS },
        Zone: { House: { IsActive: true } },
      },
      select: {
        DeviceId: true,
        Code: true,
        ZoneId: true,
        DeviceType: true,
        Mode: true,
        IsOn: true,
        Level: true,
        Zone: { select: { HouseId: true } },
      },
      orderBy: { DeviceId: 'asc' },
    });
    const latest = await p.$queryRawUnsafe<Row[]>(
      'SELECT ZoneId, MetricCode, Value, RecordedAt FROM dbo.vw_LatestReadings',
    );

    this.hysteresis = new Map(
      metrics.map((m) => [m.MetricCode, Number(m.Hysteresis)]),
    );
    this.zoneHouse = new Map(zones.map((z) => [z.ZoneId, z.HouseId]));
    this.bounds = new Map(zoneIds.map((id) => [id, {}]));
    for (const t of thresholds) this.setBound(t);
    this.devices = new Map(
      devices.map((d) => [
        d.DeviceId,
        toEntry(d as unknown as Row & { Zone: { HouseId: number } }),
      ]),
    );
    for (const r of latest)
      this.put(
        Number(r.ZoneId),
        r.MetricCode as Metric,
        Number(r.Value),
        new Date(r.RecordedAt as Date),
      );
    const now = this.clock();
    // Khoi tao chot moi lan nap (spec backend 4.4 "khoi dong hoac nap lai bo nho dem").
    this.latches = new Map(
      zoneIds.map((id) => [id, initLatches(this.zoneInputRaw(id, now))]),
    );
    this.loaded = true;
  }

  applyReadings(rows: AcceptedRow[]): void {
    for (const r of rows)
      if (this.zoneHouse.has(r.ZoneId))
        this.put(
          r.ZoneId,
          r.MetricCode as Metric,
          Number(r.Value),
          new Date(r.RecordedAt),
        );
  }

  applyDeviceState(
    deviceId: number,
    s: { mode: 'AUTO' | 'MANUAL'; isOn: boolean; level: number | null },
  ): void {
    const d = this.devices.get(deviceId);
    if (d) Object.assign(d, s);
  }

  removeDevice(id: number): void {
    this.devices.delete(id);
  }

  async reloadDevice(id: number): Promise<void> {
    const d = await this.db.prisma.devices.findUnique({
      where: { DeviceId: id },
      select: {
        DeviceId: true,
        Code: true,
        ZoneId: true,
        DeviceType: true,
        Mode: true,
        IsOn: true,
        Level: true,
        IsActive: true,
        Zone: {
          select: { HouseId: true, House: { select: { IsActive: true } } },
        },
      },
    });
    if (
      !d ||
      !d.IsActive ||
      !d.Zone.House.IsActive ||
      !ACTUATORS.includes(d.DeviceType)
    ) {
      this.devices.delete(id);
      return;
    }
    this.devices.set(id, toEntry(d));
  }

  async reloadThresholds(zoneId: number): Promise<void> {
    const rows = await this.db.prisma.thresholds.findMany({
      where: { ZoneId: zoneId },
    });
    this.bounds.set(zoneId, {});
    for (const t of rows) this.setBound(t);
  }

  addZone(zoneId: number, houseId: number): void {
    this.zoneHouse.set(zoneId, houseId);
    if (!this.bounds.has(zoneId)) this.bounds.set(zoneId, {});
    if (!this.latches.has(zoneId)) this.latches.set(zoneId, {});
  }

  zoneInput(zoneId: number, now: Date): ZoneInput | null {
    return this.zoneHouse.has(zoneId) ? this.zoneInputRaw(zoneId, now) : null;
  }

  setLatches(zoneId: number, l: Latches): void {
    this.latches.set(zoneId, l);
  }
  device(id: number): DeviceEntry | undefined {
    return this.devices.get(id);
  }
  actuators(): DeviceEntry[] {
    return [...this.devices.values()];
  }
  houseOfZone(zoneId: number): number | undefined {
    return this.zoneHouse.get(zoneId);
  }

  private zoneInputRaw(zoneId: number, now: Date): ZoneInput {
    return {
      readings: { ...(this.latest.get(zoneId) ?? {}) },
      bounds: { ...(this.bounds.get(zoneId) ?? {}) },
      actuators: [...this.devices.values()]
        .filter(
          (d) => d.zoneId === zoneId && RULE_DEVICES.includes(d.deviceType),
        )
        .map((d) => ({
          deviceId: d.deviceId,
          type: d.deviceType as ActuatorType,
          mode: d.mode,
          isOn: d.isOn,
          level: d.level,
        })),
      latches: { ...(this.latches.get(zoneId) ?? {}) },
      nowUtc: now,
      staleMinutes: STALE_MINUTES,
    };
  }

  private setBound(t: Row): void {
    const zone = this.bounds.get(Number(t.ZoneId)) ?? {};
    zone[t.MetricCode as Metric] = {
      min: num(t.MinValue),
      max: num(t.MaxValue),
      target: num(t.TargetValue),
      hysteresis: this.hysteresis.get(t.MetricCode as string) ?? 0,
    };
    this.bounds.set(Number(t.ZoneId), zone);
  }

  // Chi thay khi moi hon (spec backend 3.1: khong ghi de gia tri moi hon).
  private put(zoneId: number, metric: Metric, value: number, at: Date): void {
    const zone = this.latest.get(zoneId) ?? {};
    const cur = zone[metric];
    if (!cur || at.getTime() > cur.at.getTime()) zone[metric] = { value, at };
    this.latest.set(zoneId, zone);
  }
}
