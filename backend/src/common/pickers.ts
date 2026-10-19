import { serialize } from './serialize';

type Row = Record<string, unknown>;
const out = (o: Row) => serialize(o) as Record<string, unknown>;

// Ngay VN (cot DATE): mssql tra Date luc 00:00 UTC khi useUTC = true; chuoi giu nguyen.
export function vnDate(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export const user = (u: Row) =>
  out({
    userId: u.UserId,
    username: u.Username,
    fullName: u.FullName,
    email: u.Email,
    phone: u.Phone,
    role: u.Role,
    isActive: u.IsActive,
  });
export const house = (h: Row) =>
  out({
    houseId: h.HouseId,
    ownerId: h.OwnerId,
    name: h.Name,
    address: h.Address,
    isActive: h.IsActive,
    createdAt: h.CreatedAt,
  });
export const zone = (z: Row) =>
  out({
    zoneId: z.ZoneId,
    houseId: z.HouseId,
    name: z.Name,
    floorNo: z.FloorNo,
  });
export const device = (d: Row) =>
  out({
    deviceId: d.DeviceId,
    zoneId: d.ZoneId,
    code: d.Code,
    name: d.Name,
    deviceType: d.DeviceType,
    status: d.Status,
    lastSeenAt: d.LastSeenAt,
    mode: d.Mode,
    isOn: d.IsOn,
    level: d.Level,
    isActive: d.IsActive,
  });
export const metric = (m: Row) =>
  out({
    metricCode: m.MetricCode,
    name: m.Name,
    unit: m.Unit,
    validMin: m.ValidMin,
    validMax: m.ValidMax,
    hysteresis: m.Hysteresis,
  });
export const threshold = (t: Row) =>
  out({
    zoneId: t.ZoneId,
    metricCode: t.MetricCode,
    minValue: t.MinValue,
    maxValue: t.MaxValue,
    targetValue: t.TargetValue,
    updatedBy: t.UpdatedBy,
    updatedAt: t.UpdatedAt,
  });
export const latestReading = (r: Row) =>
  out({
    houseId: r.HouseId,
    zoneId: r.ZoneId,
    zoneName: r.ZoneName,
    deviceId: r.DeviceId,
    deviceCode: r.DeviceCode,
    deviceStatus: r.DeviceStatus,
    metric: r.MetricCode,
    unit: r.Unit,
    value: r.Value,
    at: r.RecordedAt,
  });
export const readingBucket = (r: Row) =>
  out({
    bucketUtc: r.BucketUtc,
    avgValue: r.AvgValue,
    minValue: r.MinValue,
    maxValue: r.MaxValue,
  });
export const dailyStats = (r: Row) =>
  out({
    zoneId: r.ZoneId,
    metric: r.MetricCode,
    dayVn: vnDate(r.DayVn),
    avgValue: r.AvgValue,
    minValue: r.MinValue,
    maxValue: r.MaxValue,
    samples: r.Samples,
  });
export const controlLog = (l: Row) =>
  out({
    logId: l.LogId,
    deviceId: l.DeviceId,
    isOn: l.IsOn,
    level: l.Level,
    mode: l.Mode,
    source: l.Source,
    userId: l.UserId,
    reason: l.Reason,
    createdAt: l.CreatedAt,
  });

// Cảnh báo: 14 khoa dung thu tu (hop dong 4.2); khong bao gio tra SnapshotPath.
export const alert = (a: Row) =>
  out({
    alertId: a.AlertId,
    houseId: a.HouseId,
    zoneId: a.ZoneId,
    deviceId: a.DeviceId,
    alertType: a.AlertType,
    severity: a.Severity,
    metricCode: a.MetricCode,
    value: a.Value,
    detectedClass: a.DetectedClass,
    confidence: a.Confidence,
    hasSnapshot: a.SnapshotPath !== null && a.SnapshotPath !== undefined,
    message: a.Message,
    status: a.Status,
    createdAt: a.CreatedAt,
  });
export const alertWithHistory = (a: Row & { History?: Row[] }) => ({
  ...alert(a),
  history: (a.History ?? []).map((h) =>
    out({
      historyId: h.HistoryId,
      oldStatus: h.OldStatus,
      newStatus: h.NewStatus,
      userId: h.UserId,
      note: h.Note,
      changedAt: h.ChangedAt,
    }),
  ),
});
export const alertFromSp = (a: Row) =>
  out({
    alertId: a.AlertId,
    houseId: a.HouseId,
    zoneId: a.ZoneId,
    deviceId: a.DeviceId,
    alertType: a.AlertType,
    severity: a.Severity,
    metricCode: a.MetricCode,
    value: a.Value,
    detectedClass: a.DetectedClass,
    confidence: a.Confidence,
    hasSnapshot: a.HasSnapshot,
    message: a.Message,
    status: a.Status,
    createdAt: a.CreatedAt,
  });
export const alertStatus = (a: Row) =>
  out({
    alertId: a.AlertId,
    houseId: a.HouseId,
    zoneId: a.ZoneId,
    alertType: a.AlertType,
    status: a.Status,
    resolvedAt: a.ResolvedAt,
    resolvedBy: a.ResolvedBy,
  });
export const readingEvent = (r: Row) =>
  out({
    deviceId: r.DeviceId,
    deviceCode: r.DeviceCode,
    zoneId: r.ZoneId,
    metric: r.MetricCode,
    value: r.Value,
    at: r.RecordedAt,
  });
export const birdFlow = (b: Row) =>
  out({
    houseId: b.HouseId,
    dayVn: vnDate(b.DayVn),
    inTotal: b.InTotal,
    outTotal: b.OutTotal,
    net: b.Net,
  });
export const birdCount = (b: Row) =>
  out({
    countId: b.CountId,
    cameraId: b.CameraId,
    windowStart: b.WindowStart,
    inCount: b.InCount,
    outCount: b.OutCount,
  });
export const harvest = (h: Row) =>
  out({
    harvestId: h.HarvestId,
    zoneId: h.ZoneId,
    harvestDate: vnDate(h.HarvestDate),
    nestCount: h.NestCount,
    weightGram: h.WeightGram,
    grade: h.Grade,
    recordedBy: h.RecordedBy,
    createdAt: h.CreatedAt,
  });
