import { Injectable } from '@nestjs/common';
import { parseJsonColumn } from '../common/serialize';
import { DbService } from './db.service';
import { sqlNumberOf } from './sql-errors';

export interface ReadingItem {
  device: string;
  metric: string;
  value: number;
  at: string;
}
export interface AcceptedRow {
  DeviceId: number;
  DeviceCode: string;
  HouseId: number;
  ZoneId: number;
  MetricCode: string;
  Value: number;
  RecordedAt: string;
}
export type SpAlert = Record<string, unknown>;
export interface IngestResult {
  received: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  acceptedRows: AcceptedRow[];
  newAlerts: SpAlert[];
  resolvedAlertIds: number[];
}
export interface SetActuatorArgs {
  deviceId: number;
  isOn: boolean;
  level: number | null;
  source: 'AUTO' | 'MANUAL';
  mode: 'AUTO' | 'MANUAL' | null;
  userId: number | null;
  reason: string | null;
}
export interface ActuatorResult {
  changed: boolean;
  deviceCode: string;
  mode: 'AUTO' | 'MANUAL';
  isOn: boolean;
  level: number | null;
}
export interface BirdCountItem {
  camera: string;
  windowStart: string;
  in: number;
  out: number;
}
export interface PredatorInput {
  camera: string;
  class: string;
  confidence: number;
  snapshot: string;
  at: string;
}
export interface HeartbeatItem {
  device: string;
  at: string;
}

type Row = Record<string, unknown>;
const ids = (json: unknown) =>
  parseJsonColumn<Array<{ AlertId: number }>>(json as string, []).map(
    (x) => x.AlertId,
  );

// Cua duy nhat goi SP (spec backend 2.2). Moi SP tra dung 1 tap ket qua (database-core Phan 3).
@Injectable()
export class SpService {
  constructor(private readonly db: DbService) {}

  async ingestReadings(items: ReadingItem[]): Promise<IngestResult> {
    const r = await this.one(
      'EXEC dbo.sp_IngestReadings @Json = @P1',
      JSON.stringify(items),
    );
    return {
      received: Number(r.Received),
      accepted: Number(r.Accepted),
      duplicates: Number(r.Duplicates),
      rejected: Number(r.Rejected),
      acceptedRows: parseJsonColumn<AcceptedRow[]>(
        r.AcceptedJson as string,
        [],
      ),
      newAlerts: parseJsonColumn<SpAlert[]>(r.NewAlertsJson as string, []),
      resolvedAlertIds: ids(r.ResolvedAlertIdsJson),
    };
  }

  async setActuator(a: SetActuatorArgs): Promise<ActuatorResult> {
    const r = await this.one(
      'EXEC dbo.sp_SetActuator @DeviceId = @P1, @IsOn = @P2, @Level = @P3, @Source = @P4, @Mode = @P5, @UserId = @P6, @Reason = @P7',
      a.deviceId,
      a.isOn,
      a.level,
      a.source,
      a.mode,
      a.userId,
      a.reason,
    );
    return {
      changed: Boolean(r.Changed),
      deviceCode: String(r.DeviceCode),
      mode: r.Mode as 'AUTO' | 'MANUAL',
      isOn: Boolean(r.IsOn),
      level: r.Level === null ? null : Number(r.Level),
    };
  }

  updateAlertStatus(
    alertId: number,
    status: string,
    userId: number,
    note: string | null,
  ): Promise<Row> {
    return this.one(
      'EXEC dbo.sp_UpdateAlertStatus @AlertId = @P1, @Status = @P2, @UserId = @P3, @Note = @P4',
      alertId,
      status,
      userId,
      note,
    );
  }

  readingHistory(
    zoneId: number,
    metric: string,
    from: Date,
    to: Date,
    bucketMinutes: number,
  ): Promise<Row[]> {
    return this.rows(
      'EXEC dbo.sp_GetReadingHistory @ZoneId = @P1, @MetricCode = @P2, @FromUtc = @P3, @ToUtc = @P4, @BucketMinutes = @P5',
      zoneId,
      metric,
      from,
      to,
      bucketMinutes,
    );
  }

  async recordBirdCount(
    items: BirdCountItem[],
  ): Promise<{ windowsUpserted: number; windowsUnchanged: number }> {
    const r = await this.one(
      'EXEC dbo.sp_RecordBirdCount @Json = @P1',
      JSON.stringify(items),
    );
    return {
      windowsUpserted: Number(r.WindowsUpserted),
      windowsUnchanged: Number(r.WindowsUnchanged),
    };
  }

  async createPredatorAlert(p: PredatorInput): Promise<{
    created: boolean;
    alertId: number | null;
    skipReason: string | null;
    alert: SpAlert | null;
  }> {
    const r = await this.one(
      'EXEC dbo.sp_CreatePredatorAlert @Json = @P1',
      JSON.stringify(p),
    );
    return {
      created: Boolean(r.Created),
      alertId: r.AlertId === null ? null : Number(r.AlertId),
      skipReason: (r.SkipReason as string) ?? null,
      alert: parseJsonColumn<SpAlert | null>(r.AlertJson as string, null),
    };
  }

  async detectAnomalies(
    opts: { nowUtc?: Date; offlineMinutes?: number } = {},
  ): Promise<SpAlert[]> {
    const r = await this.one(
      'EXEC dbo.sp_DetectAnomalies @OfflineMinutes = @P1, @NowUtc = @P2',
      opts.offlineMinutes ?? 5,
      opts.nowUtc ?? null,
    );
    return parseJsonColumn<SpAlert[]>(r.NewAlertsJson as string, []);
  }

  async recordHeartbeat(items: HeartbeatItem[]): Promise<{
    accepted: number;
    rejected: number;
    resolvedAlertIds: number[];
  }> {
    const r = await this.one(
      'EXEC dbo.sp_RecordHeartbeat @Json = @P1',
      JSON.stringify(items),
    );
    return {
      accepted: Number(r.Accepted),
      rejected: Number(r.Rejected),
      resolvedAlertIds: ids(r.ResolvedAlertIdsJson),
    };
  }

  reportEnvVsYield(
    houseId: number,
    fromVnDate: string,
    toVnDate: string,
  ): Promise<Row[]> {
    return this.rows(
      'EXEC dbo.sp_Report_EnvStabilityVsYield @HouseId = @P1, @FromVnDate = @P2, @ToVnDate = @P3',
      houseId,
      fromVnDate,
      toVnDate,
    );
  }

  private async rows(sql: string, ...params: unknown[]): Promise<Row[]> {
    try {
      return await this.db.prisma.$queryRawUnsafe<Row[]>(sql, ...params);
    } catch (e) {
      if (sqlNumberOf(e) !== 1205) throw e;
      return this.db.prisma.$queryRawUnsafe<Row[]>(sql, ...params); // hop dong 3.5: thu lai 1 lan
    }
  }

  private async one(sql: string, ...params: unknown[]): Promise<Row> {
    const rows = await this.rows(sql, ...params);
    if (rows.length !== 1)
      throw new Error(
        `SP tra ${rows.length} dong, mong 1: ${sql.split(' ')[1]}`,
      );
    return rows[0];
  }
}
