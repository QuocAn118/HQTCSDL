/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- gia lap Prisma async; mock.calls cua jest.fn la any */
import { HousesService } from './houses.service';

const OWNER = { userId: 2, role: 'OWNER' as const, username: 'owner1', exp: 0 };
const ADMIN = { userId: 1, role: 'ADMIN' as const, username: 'admin', exp: 0 };
const NOW = new Date(Date.UTC(2026, 9, 12));

function setup() {
  const prisma = {
    houses: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => ({
        HouseId: 5,
        IsActive: true,
        CreatedAt: NOW,
        Address: null,
        ...data,
      })),
      findUniqueOrThrow: jest.fn(async () => ({
        HouseId: 5,
        OwnerId: 2,
        Name: 'N',
        Address: null,
        IsActive: true,
        CreatedAt: NOW,
      })),
      update: jest.fn(async ({ data }) => ({
        HouseId: 5,
        OwnerId: 2,
        Name: 'N',
        Address: null,
        IsActive: true,
        CreatedAt: NOW,
        ...data,
      })),
    },
    zones: { create: jest.fn(async ({ data }) => ({ ZoneId: 30, ...data })) },
    devices: {
      findUniqueOrThrow: jest.fn(async () => ({
        DeviceId: 40,
        ZoneId: 30,
        Code: 'H1-F9-FAN',
        Name: 'Q',
        DeviceType: 'FAN',
        Status: 'OFFLINE',
        LastSeenAt: null,
        Mode: 'AUTO',
        IsOn: false,
        Level: 0,
        IsActive: true,
      })),
    },
    thresholds: {
      upsert: jest.fn(async ({ create }) => ({ ...create, UpdatedAt: NOW })),
    },
    $queryRawUnsafe: jest.fn(async () => [{ DeviceId: 40 }]),
    $executeRawUnsafe: jest.fn(async () => 1),
  };
  const cache = {
    load: jest.fn(async () => undefined),
    addZone: jest.fn(),
    reloadDevice: jest.fn(async () => undefined),
    removeDevice: jest.fn(),
    reloadThresholds: jest.fn(async () => undefined),
  };
  const loop = { runZones: jest.fn(async () => undefined) };
  const rt = { houseActivated: jest.fn(), houseDeactivated: jest.fn() };
  return {
    svc: new HousesService(
      { prisma } as never,
      cache as never,
      loop as never,
      rt as never,
    ),
    prisma,
    cache,
    loop,
    rt,
  };
}

describe('HousesService', () => {
  it('OWNER gui ownerId -> 400; ADMIN khong gui ownerId -> 400; OWNER tao nha -> ownerId tu JWT, vao phong', async () => {
    const { svc, prisma, rt } = setup();
    await expect(
      svc.createHouse(OWNER, { name: 'N', ownerId: 3 }),
    ).rejects.toMatchObject({ status: 400, details: { fields: ['ownerId'] } });
    await expect(svc.createHouse(ADMIN, { name: 'N' })).rejects.toMatchObject({
      status: 400,
      details: { fields: ['ownerId'] },
    });
    await svc.createHouse(OWNER, { name: 'N' });
    expect(prisma.houses.create.mock.calls[0][0].data).toEqual({
      Name: 'N',
      Address: null,
      OwnerId: 2,
    });
    expect(rt.houseActivated).toHaveBeenCalledWith(5, 2);
  });

  it('ngung dung nha -> roi phong, nap lai bo nho dem; dung lai -> vao phong', async () => {
    const { svc, rt, cache, prisma } = setup();
    prisma.houses.update.mockResolvedValueOnce({
      HouseId: 5,
      OwnerId: 2,
      Name: 'N',
      Address: null,
      IsActive: false,
      CreatedAt: NOW,
    });
    await svc.updateHouse(5, { isActive: false });
    expect(rt.houseDeactivated).toHaveBeenCalledWith(5);
    expect(cache.load).toHaveBeenCalled();
    await svc.updateHouse(5, { isActive: true });
    expect(rt.houseActivated).toHaveBeenCalledWith(5, 2);
  });

  it('tao khu vuc -> them vao bo nho dem', async () => {
    const { svc, cache } = setup();
    await svc.createZone(5, { name: 'F9', floorNo: 9 });
    expect(cache.addZone).toHaveBeenCalledWith(30, 5);
  });

  it.each([
    ['FAN', 'AUTO', false, 0],
    ['MIST', 'AUTO', false, null],
    ['SPEAKER', 'AUTO', false, null],
    ['SENSOR', null, null, null],
    ['CAMERA', null, null, null],
  ])(
    'tao thiet bi %s: trang thai dau Mode=%s IsOn=%s Level=%s, qua $queryRaw, nap vao bo nho dem',
    async (type, mode, isOn, level) => {
      const { svc, prisma, cache } = setup();
      await svc.createDevice(30, {
        code: 'H1-F9-X',
        name: 'x',
        deviceType: type as never,
      });
      const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
        string,
        ...unknown[],
      ];
      expect(sql).toMatch(/INSERT INTO dbo\.Devices/);
      expect(sql).toMatch(/OUTPUT INSERTED\.DeviceId INTO @t/);
      expect(params).toEqual([30, 'H1-F9-X', 'x', type, mode, isOn, level]);
      expect(cache.reloadDevice).toHaveBeenCalledWith(40);
    },
  );

  it('ngung dung thiet bi: UPDATE qua $executeRaw (khong OUTPUT), bo khoi bo nho dem', async () => {
    const { svc, prisma, cache } = setup();
    await svc.updateDevice(40, { isActive: false });
    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toMatch(/^UPDATE dbo\.Devices SET/);
    expect(sql).not.toMatch(/OUTPUT/);
    expect(params).toEqual([null, false, 40]);
    expect(cache.removeDevice).toHaveBeenCalledWith(40);
  });

  it('PUT nguong: upsert UpdatedBy tu JWT, lam moi nguong roi chay vong cho khu vuc', async () => {
    const { svc, prisma, cache, loop } = setup();
    const r = await svc.putThreshold(OWNER, 10, 'TEMP', {
      minValue: 25,
      maxValue: 31,
      targetValue: 28,
    });
    expect(prisma.thresholds.upsert.mock.calls[0][0].update).toMatchObject({
      MinValue: 25,
      MaxValue: 31,
      TargetValue: 28,
      UpdatedBy: 2,
    });
    expect(cache.reloadThresholds).toHaveBeenCalledWith(10);
    expect(loop.runZones).toHaveBeenCalledWith([10]);
    expect(r).toMatchObject({ zoneId: 10, metricCode: 'TEMP', updatedBy: 2 });
  });

  // Cung loi T15-L5: void runZones khong bat loi -> unhandled rejection.
  it('PUT nguong: runZones bi tu choi -> log loi, van tra nguong', async () => {
    const { svc, loop } = setup();
    loop.runZones.mockRejectedValue(new Error('vong hong'));
    const err = jest
      .spyOn(
        (svc as unknown as { log: { error: (m: string) => void } }).log,
        'error',
      )
      .mockImplementation(() => undefined);
    await expect(
      svc.putThreshold(OWNER, 10, 'TEMP', { maxValue: 31 }),
    ).resolves.toMatchObject({ zoneId: 10 });
    await new Promise((r) => setImmediate(r));
    expect(err).toHaveBeenCalledWith(expect.stringContaining('vong hong'));
  });
});
