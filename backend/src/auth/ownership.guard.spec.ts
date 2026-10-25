/* eslint-disable @typescript-eslint/require-await -- gia lap ham async cua Prisma trong file test */
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard';

const owner = (HouseId: number, OwnerId: number) => ({
  HouseId,
  House: { OwnerId },
  OwnerId,
  Zone: { HouseId, House: { OwnerId } },
});
const db = {
  prisma: {
    houses: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, number> }) =>
          where.HouseId === 1 ? { HouseId: 1, OwnerId: 2 } : null,
      ),
    },
    zones: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, number> }) =>
          where.ZoneId === 10 ? owner(1, 2) : null,
      ),
    },
    devices: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, number> }) =>
          where.DeviceId === 20 ? owner(1, 2) : null,
      ),
    },
    alerts: {
      findUnique: jest.fn(
        async ({ where }: { where: Record<string, number> }) =>
          where.AlertId === 30 ? owner(1, 2) : null,
      ),
    },
  },
};
const ctx = (req: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => 0,
    getClass: () => class {},
  }) as never;
const g = new OwnershipGuard(new Reflector(), db as never);
const OWNER1 = { userId: 2, role: 'OWNER' };
const OWNER2 = { userId: 3, role: 'OWNER' };
const ADMIN = { userId: 1, role: 'ADMIN' };

describe('OwnershipGuard', () => {
  it.each([
    ['houseId', '1'],
    ['zoneId', '10'],
    ['deviceId', '20'],
    ['alertId', '30'],
  ])('chu so huu qua %s, gan req.houseId', async (k, v) => {
    const req: Record<string, unknown> = { user: OWNER1, params: { [k]: v } };
    await expect(g.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.houseId).toBe(1);
  });

  it('OWNER khac -> 404 NOT_FOUND (khong 403)', async () => {
    await expect(
      g.canActivate(ctx({ user: OWNER2, params: { houseId: '1' } })),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('khong ton tai -> 404; ADMIN qua moi nha', async () => {
    await expect(
      g.canActivate(ctx({ user: ADMIN, params: { zoneId: '99' } })),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      g.canActivate(ctx({ user: ADMIN, params: { deviceId: '20' } })),
    ).resolves.toBe(true);
  });

  it('id khong phai so nguyen duong -> 404 khong truy van', async () => {
    db.prisma.houses.findUnique.mockClear();
    for (const v of ['abc', '-1', '1.5', '99999999999']) {
      await expect(
        g.canActivate(ctx({ user: OWNER1, params: { houseId: v } })),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(db.prisma.houses.findUnique).not.toHaveBeenCalled();
  });

  it('route khong co tham so so huu -> qua', async () => {
    await expect(
      g.canActivate(ctx({ user: OWNER1, params: { userId: '5' } })),
    ).resolves.toBe(true);
  });
});
