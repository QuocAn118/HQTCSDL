import * as pick from './pickers';

class Decimal {
  constructor(private readonly s: string) {}
  toFixed() {
    return this.s;
  }
  toString() {
    return this.s;
  }
}
const ALERT_KEYS = [
  'alertId',
  'houseId',
  'zoneId',
  'deviceId',
  'alertType',
  'severity',
  'metricCode',
  'value',
  'detectedClass',
  'confidence',
  'hasSnapshot',
  'message',
  'status',
  'createdAt',
];

const alertRow = {
  AlertId: 7,
  HouseId: 1,
  ZoneId: 2,
  DeviceId: null,
  AlertType: 'THRESHOLD',
  Severity: 'WARNING',
  MetricCode: 'TEMP',
  Value: new Decimal('31.20'),
  DetectedClass: null,
  Confidence: null,
  SnapshotPath: 'snapshots/x.jpg',
  Message: 'm',
  Status: 'NEW',
  CreatedAt: new Date(Date.UTC(2026, 9, 12)),
  ResolvedAt: null,
  ResolvedBy: null,
};

describe('pickers', () => {
  it('alert: dung 14 khoa dung thu tu, hasSnapshot thay SnapshotPath', () => {
    const a = pick.alert(alertRow);
    expect(Object.keys(a)).toEqual(ALERT_KEYS);
    expect(a.hasSnapshot).toBe(true);
    expect(a.value).toBe(31.2);
    expect(JSON.stringify(a)).not.toContain('snapshots/');
  });

  it('alertFromSp: cot JSON PascalCase cua SP -> 14 khoa', () => {
    const sp = {
      AlertId: 1,
      HouseId: 1,
      ZoneId: null,
      DeviceId: 3,
      AlertType: 'PREDATOR',
      Severity: 'CRITICAL',
      MetricCode: null,
      Value: null,
      DetectedClass: 'snake',
      Confidence: 0.87,
      HasSnapshot: true,
      Message: 'x',
      Status: 'NEW',
      CreatedAt: '2026-10-12T10:40:00Z',
    };
    expect(Object.keys(pick.alertFromSp(sp) as object)).toEqual(ALERT_KEYS);
  });

  it('user: khong bao gio co passwordHash', () => {
    const u = pick.user({
      UserId: 2,
      Username: 'owner1',
      PasswordHash: '$2a$10$x',
      FullName: 'A',
      Email: 'e',
      Phone: null,
      Role: 'OWNER',
      IsActive: true,
      CreatedAt: new Date(),
    });
    expect(u).toEqual({
      userId: 2,
      username: 'owner1',
      fullName: 'A',
      email: 'e',
      phone: null,
      role: 'OWNER',
      isActive: true,
    });
  });

  it('latestReading va readingEvent: MetricCode -> metric, RecordedAt -> at', () => {
    const at = new Date(Date.UTC(2026, 9, 12, 10, 40));
    expect(
      pick.latestReading({
        HouseId: 1,
        ZoneId: 2,
        ZoneName: 'F1',
        DeviceId: 5,
        DeviceCode: 'H1-F1-SENSOR',
        DeviceStatus: 'ONLINE',
        MetricCode: 'TEMP',
        Unit: '°C',
        Value: new Decimal('28.5'),
        RecordedAt: at,
      }),
    ).toEqual({
      houseId: 1,
      zoneId: 2,
      zoneName: 'F1',
      deviceId: 5,
      deviceCode: 'H1-F1-SENSOR',
      deviceStatus: 'ONLINE',
      metric: 'TEMP',
      unit: '°C',
      value: 28.5,
      at: '2026-10-12T10:40:00.000Z',
    });
    expect(
      pick.readingEvent({
        DeviceId: 5,
        DeviceCode: 'H1-F1-SENSOR',
        HouseId: 1,
        ZoneId: 2,
        MetricCode: 'TEMP',
        Value: 31.2,
        RecordedAt: '2026-10-12T10:40:07Z',
      }),
    ).toEqual({
      deviceId: 5,
      deviceCode: 'H1-F1-SENSOR',
      zoneId: 2,
      metric: 'TEMP',
      value: 31.2,
      at: '2026-10-12T10:40:07Z',
    });
  });

  it('threshold giu metricCode; dailyStats/birdFlow doi ngay VN thanh YYYY-MM-DD', () => {
    expect(
      pick.threshold({
        ZoneId: 2,
        MetricCode: 'TEMP',
        MinValue: new Decimal('25'),
        MaxValue: new Decimal('31'),
        TargetValue: null,
        UpdatedBy: 2,
        UpdatedAt: new Date(0),
      }),
    ).toEqual({
      zoneId: 2,
      metricCode: 'TEMP',
      minValue: 25,
      maxValue: 31,
      targetValue: null,
      updatedBy: 2,
      updatedAt: '1970-01-01T00:00:00.000Z',
    });
    expect(
      pick.birdFlow({
        HouseId: 1,
        DayVn: new Date(Date.UTC(2026, 9, 12)),
        InTotal: 10,
        OutTotal: 3,
        Net: 7,
      }),
    ).toEqual({
      houseId: 1,
      dayVn: '2026-10-12',
      inTotal: 10,
      outTotal: 3,
      net: 7,
    });
    expect(pick.vnDate('2026-10-12')).toBe('2026-10-12');
  });

  it('alertStatus: cot cua sp_UpdateAlertStatus', () => {
    expect(
      pick.alertStatus({
        AlertId: 7,
        HouseId: 1,
        ZoneId: 4,
        AlertType: 'THRESHOLD',
        Status: 'ACK',
        ResolvedAt: null,
        ResolvedBy: null,
      }),
    ).toEqual({
      alertId: 7,
      houseId: 1,
      zoneId: 4,
      alertType: 'THRESHOLD',
      status: 'ACK',
      resolvedAt: null,
      resolvedBy: null,
    });
  });
});
