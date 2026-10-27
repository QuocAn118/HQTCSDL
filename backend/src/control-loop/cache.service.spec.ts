/* eslint-disable @typescript-eslint/require-await -- gia lap ham async cua Prisma trong file test */
import { ControlCache } from './cache.service';

const T0 = new Date(Date.UTC(2026, 9, 12, 10, 40, 0));
const later = (s: number) => new Date(T0.getTime() + s * 1000);

function fakeDb(latestAt = T0, latestTemp = 31) {
  const prisma = {
    metrics: {
      findMany: async () => [
        { MetricCode: 'TEMP', Hysteresis: 0.5 },
        { MetricCode: 'HUMID', Hysteresis: 2 },
        { MetricCode: 'CO2', Hysteresis: 50 },
        { MetricCode: 'LIGHT', Hysteresis: 2 },
      ],
    },
    zones: { findMany: async () => [{ ZoneId: 10, HouseId: 1 }] },
    thresholds: {
      findMany: jest.fn(async () => [
        {
          ZoneId: 10,
          MetricCode: 'TEMP',
          MinValue: 26,
          MaxValue: 30,
          TargetValue: 28,
        },
      ]),
    },
    devices: {
      findMany: async () => [
        {
          DeviceId: 20,
          Code: 'H1-F1-FAN',
          ZoneId: 10,
          DeviceType: 'FAN',
          Mode: 'AUTO',
          IsOn: false,
          Level: 0,
          Zone: { HouseId: 1 },
        },
        {
          DeviceId: 21,
          Code: 'H1-F0-SPEAKER',
          ZoneId: 10,
          DeviceType: 'SPEAKER',
          Mode: 'AUTO',
          IsOn: false,
          Level: null,
          Zone: { HouseId: 1 },
        },
      ],
      findUnique: jest.fn(async () => ({
        DeviceId: 22,
        Code: 'H1-F1-MIST',
        ZoneId: 10,
        DeviceType: 'MIST',
        Mode: 'AUTO',
        IsOn: false,
        Level: null,
        IsActive: true,
        Zone: { HouseId: 1, House: { IsActive: true } },
      })),
    },
    $queryRawUnsafe: jest.fn(async () => [
      {
        ZoneId: 10,
        MetricCode: 'TEMP',
        Value: latestTemp,
        RecordedAt: latestAt,
      },
    ]),
  };
  return { prisma };
}

describe('ControlCache', () => {
  it('load: nap nguong + Hysteresis, thiet bi (ca SPEAKER), gia tri moi nhat, khoi tao chot', async () => {
    const c = new ControlCache(fakeDb() as never, () => later(1));
    await c.load();
    expect(c.isLoaded()).toBe(true);
    const z = c.zoneInput(10, later(1))!;
    expect(z.bounds.TEMP).toEqual({
      min: 26,
      max: 30,
      target: 28,
      hysteresis: 0.5,
    });
    expect(z.actuators.map((a) => a.type)).toEqual(['FAN']);
    expect(c.actuators().map((d) => d.code)).toEqual([
      'H1-F1-FAN',
      'H1-F0-SPEAKER',
    ]);
    expect(z.latches.TEMP_HIGH).toBe(true);
    expect(c.houseOfZone(10)).toBe(1);
  });

  it('khong ghi de gia tri moi hon: ca khi nap lai va khi applyReadings', async () => {
    const db = fakeDb(T0, 31);
    const c = new ControlCache(db as never);
    await c.load();
    c.applyReadings([
      {
        DeviceId: 5,
        DeviceCode: 'H1-F1-SENSOR',
        HouseId: 1,
        ZoneId: 10,
        MetricCode: 'TEMP',
        Value: 27,
        RecordedAt: later(10).toISOString(),
      },
    ]);
    await c.load(); // vw_LatestReadings van tra T0 (cu hon)
    expect(c.zoneInput(10, later(11))!.readings.TEMP).toEqual({
      value: 27,
      at: later(10),
    });
    c.applyReadings([
      {
        DeviceId: 5,
        DeviceCode: 'H1-F1-SENSOR',
        HouseId: 1,
        ZoneId: 10,
        MetricCode: 'TEMP',
        Value: 40,
        RecordedAt: later(5).toISOString(),
      },
    ]);
    expect(c.zoneInput(10, later(11))!.readings.TEMP!.value).toBe(27);
  });

  it('applyDeviceState, removeDevice, reloadDevice', async () => {
    const c = new ControlCache(fakeDb() as never);
    await c.load();
    c.applyDeviceState(20, { mode: 'MANUAL', isOn: true, level: 80 });
    expect(c.device(20)).toMatchObject({
      mode: 'MANUAL',
      isOn: true,
      level: 80,
    });
    c.removeDevice(20);
    expect(c.device(20)).toBeUndefined();
    await c.reloadDevice(22);
    expect(c.device(22)).toMatchObject({ code: 'H1-F1-MIST', houseId: 1 });
  });

  it('zoneInput khu vuc khong co -> null; addZone -> co (chua nguong, chua thiet bi)', async () => {
    const c = new ControlCache(fakeDb() as never);
    await c.load();
    expect(c.zoneInput(99, T0)).toBeNull();
    c.addZone(99, 1);
    expect(c.zoneInput(99, T0)).toMatchObject({ bounds: {}, actuators: [] });
  });
});
