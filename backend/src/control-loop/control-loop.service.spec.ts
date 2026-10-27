/* eslint-disable @typescript-eslint/require-await -- gia lap ham async trong file test */
import type { SetActuatorArgs } from '../db/sp';
import { ControlLoopService } from './control-loop.service';
import { ControlCache } from './cache.service';

const NOW = new Date(Date.UTC(2026, 9, 12, 10, 40, 7));

function setup(opts: { setActuator?: jest.Mock } = {}) {
  const cache = new ControlCache({} as never, () => NOW);
  // Nap tay khong qua CSDL: 2 khu vuc, moi khu vuc FAN + MIST.
  Object.assign(cache as unknown as Record<string, unknown>, { loaded: true });
  cache.addZone(10, 1);
  cache.addZone(11, 1);
  for (const [zone, base] of [
    [10, 100],
    [11, 200],
  ]) {
    (cache as unknown as { devices: Map<number, unknown> }).devices.set(base, {
      deviceId: base,
      code: `Z${zone}-FAN`,
      zoneId: zone,
      houseId: 1,
      deviceType: 'FAN',
      mode: 'AUTO',
      isOn: false,
      level: 0,
    });
    (cache as unknown as { devices: Map<number, unknown> }).devices.set(
      base + 1,
      {
        deviceId: base + 1,
        code: `Z${zone}-MIST`,
        zoneId: zone,
        houseId: 1,
        deviceType: 'MIST',
        mode: 'AUTO',
        isOn: false,
        level: null,
      },
    );
    (cache as unknown as { bounds: Map<number, unknown> }).bounds.set(zone, {
      TEMP: { min: 26, max: 30, target: 28, hysteresis: 0.5 },
      HUMID: { min: 75, max: 90, target: 82, hysteresis: 2 },
    });
  }
  const setActuator =
    opts.setActuator ??
    jest.fn(async (a: SetActuatorArgs) => ({
      changed: true,
      deviceCode: `D${a.deviceId}`,
      mode: 'AUTO',
      isOn: a.isOn,
      level: a.level,
    }));
  const sp = { setActuator };
  const mqtt = {
    publishCommand: jest.fn(async () => undefined),
    onConnect: jest.fn(),
  };
  const rt = { emitToHouse: jest.fn() };
  const db = { addLoader: jest.fn() };
  const loop = new ControlLoopService(
    cache,
    sp as never,
    mqtt as never,
    rt as never,
    db as never,
    () => NOW,
  );
  const read = (zone: number, metric: string, value: number) =>
    cache.applyReadings([
      {
        DeviceId: 1,
        DeviceCode: 'S',
        HouseId: 1,
        ZoneId: zone,
        MetricCode: metric,
        Value: value,
        RecordedAt: NOW.toISOString(),
      },
    ]);
  return { loop, cache, sp, mqtt, rt, read, setActuator };
}

describe('ControlLoopService.runZones', () => {
  it('TEMP > Max -> sp_SetActuator AUTO Level 100; cap nhat bo nho dem tu KET QUA SP; publish + device.state', async () => {
    const { loop, cache, read, setActuator, mqtt, rt } = setup({
      setActuator: jest.fn(async () => ({
        changed: true,
        deviceCode: 'Z10-FAN',
        mode: 'AUTO',
        isOn: true,
        level: 100,
      })),
    });
    read(10, 'TEMP', 30.6);
    await loop.runZones([10]);
    expect(setActuator).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 100,
        isOn: true,
        level: 100,
        source: 'AUTO',
        mode: null,
        userId: null,
        reason: 'TEMP 30.6 > Max 30',
      }),
    );
    expect(cache.device(100)).toMatchObject({ isOn: true, level: 100 });
    expect(mqtt.publishCommand).toHaveBeenCalledWith('Z10-FAN', {
      isOn: true,
      level: 100,
      mode: 'AUTO',
    });
    expect(rt.emitToHouse).toHaveBeenCalledWith(
      1,
      'device.state',
      expect.objectContaining({
        deviceId: 100,
        deviceCode: 'Z10-FAN',
        houseId: 1,
        zoneId: 10,
        source: 'AUTO',
        at: NOW,
      }),
    );
  });

  it('Changed = 0 -> khong publish, khong phat; van cap nhat bo nho dem', async () => {
    const { loop, cache, read, mqtt, rt } = setup({
      setActuator: jest.fn(async () => ({
        changed: false,
        deviceCode: 'Z10-FAN',
        mode: 'MANUAL',
        isOn: false,
        level: 0,
      })),
    });
    read(10, 'TEMP', 31);
    await loop.runZones([10]);
    expect(mqtt.publishCommand).not.toHaveBeenCalled();
    expect(rt.emitToHouse).not.toHaveBeenCalled();
    expect(cache.device(100)?.mode).toBe('MANUAL');
  });

  it('mot lenh loi khong chan lenh khac cung luot; hai khu vuc doc lap trong mot lo', async () => {
    const setActuator = jest.fn(async (a: SetActuatorArgs) => {
      if (a.deviceId === 100) throw new Error('loi gia');
      return {
        changed: true,
        deviceCode: `D${a.deviceId}`,
        mode: 'AUTO',
        isOn: a.isOn,
        level: a.level,
      };
    });
    const { loop, read } = setup({ setActuator });
    read(10, 'TEMP', 31);
    read(10, 'HUMID', 70); // FAN 100 (loi) + MIST
    read(11, 'TEMP', 27); // khong lenh
    await loop.runZones([10, 11, 10]);
    expect(setActuator.mock.calls.map((c) => c[0].deviceId).sort()).toEqual([
      100, 101,
    ]);
  });

  it('lenh qua 5 giay -> bo, chay lenh tiep', async () => {
    jest.useFakeTimers();
    const setActuator = jest.fn((a: SetActuatorArgs) =>
      a.deviceId === 100
        ? new Promise(() => undefined)
        : Promise.resolve({
            changed: true,
            deviceCode: 'x',
            mode: 'AUTO',
            isOn: true,
            level: null,
          }),
    );
    const { loop, read } = setup({ setActuator });
    read(10, 'TEMP', 31);
    read(10, 'HUMID', 70);
    const p = loop.runZones([10]);
    await jest.advanceTimersByTimeAsync(5001);
    await p;
    expect(setActuator).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('lenh AUTO nhan 50003 -> bo thiet bi khoi bo nho dem', async () => {
    const { loop, cache, read } = setup({
      setActuator: jest.fn(async () => {
        throw Object.assign(new Error('x'), { number: 50003 });
      }),
    });
    read(10, 'TEMP', 31);
    await loop.runZones([10]);
    expect(cache.device(100)).toBeUndefined();
  });
});

describe('ControlLoopService.executeManual (Review Focus 5)', () => {
  it('cung hang doi voi vong tu dong: bo nho dem = ket qua SP sau cung', async () => {
    let release!: () => void;
    const setActuator = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            release = () =>
              r({
                changed: true,
                deviceCode: 'Z10-FAN',
                mode: 'AUTO',
                isOn: true,
                level: 100,
              });
          }),
      )
      .mockImplementationOnce(async () => ({
        changed: true,
        deviceCode: 'Z10-FAN',
        mode: 'MANUAL',
        isOn: false,
        level: 0,
      }));
    const { loop, cache, read } = setup({ setActuator });
    read(10, 'TEMP', 31);
    const auto = loop.runZones([10]);
    const manual = loop.executeManual({
      deviceId: 100,
      isOn: false,
      level: 0,
      source: 'MANUAL',
      mode: 'MANUAL',
      userId: 2,
      reason: null,
    });
    await Promise.resolve();
    expect(setActuator).toHaveBeenCalledTimes(1); // lenh tay cho lenh tu dong xong
    release();
    await Promise.all([auto, manual]);
    expect(cache.device(100)).toMatchObject({
      mode: 'MANUAL',
      isOn: false,
      level: 0,
    });
  });
});

describe('ControlLoopService.requestResync', () => {
  it('cho bo nho dem nap xong; toi da 1 lan moi 5 giay; publish moi co cau chap hanh', async () => {
    jest.useFakeTimers();
    const { loop, cache, mqtt } = setup();
    Object.assign(cache as unknown as Record<string, unknown>, {
      loaded: false,
    });
    loop.requestResync();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).not.toHaveBeenCalled();
    Object.assign(cache as unknown as Record<string, unknown>, {
      loaded: true,
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(4);
    loop.requestResync();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(5000);
    expect(mqtt.publishCommand).toHaveBeenCalledTimes(8);
    jest.useRealTimers();
  });
});
