import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { IS_PUBLIC } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { DbService } from '../db/db.service';

export type OwnedKind = 'alertId' | 'deviceId' | 'zoneId' | 'houseId';
const KINDS: OwnedKind[] = ['alertId', 'deviceId', 'zoneId', 'houseId'];
const notFound = () => new ApiError(404, 'NOT_FOUND');

// Mot truy van lan ra nha (spec backend 5.2).
export async function ownerOf(
  db: DbService,
  kind: OwnedKind,
  id: number,
): Promise<{ houseId: number; ownerId: number } | null> {
  const p = db.prisma;
  const viaHouse = { select: { OwnerId: true } } as const;
  switch (kind) {
    case 'houseId': {
      const h = await p.houses.findUnique({
        where: { HouseId: id },
        select: { HouseId: true, OwnerId: true },
      });
      return h && { houseId: h.HouseId, ownerId: h.OwnerId };
    }
    case 'zoneId': {
      const z = await p.zones.findUnique({
        where: { ZoneId: id },
        select: { HouseId: true, House: viaHouse },
      });
      return z && { houseId: z.HouseId, ownerId: z.House.OwnerId };
    }
    case 'deviceId': {
      const d = await p.devices.findUnique({
        where: { DeviceId: id },
        select: { Zone: { select: { HouseId: true, House: viaHouse } } },
      });
      return d && { houseId: d.Zone.HouseId, ownerId: d.Zone.House.OwnerId };
    }
    case 'alertId': {
      const a = await p.alerts.findUnique({
        where: { AlertId: id },
        select: { HouseId: true, House: viaHouse },
      });
      return a && { houseId: a.HouseId, ownerId: a.House.OwnerId };
    }
  }
}

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest<{
      params?: Record<string, unknown>;
      user: AuthUser;
      houseId?: number;
    }>();
    const kind = KINDS.find((k) => req.params?.[k] !== undefined);
    if (!kind) return true;
    const raw = String(req.params![kind]);
    if (!/^[1-9]\d{0,8}$/.test(raw)) throw notFound();
    const found = await ownerOf(this.db, kind, Number(raw));
    const user = req.user;
    if (!found || (user.role !== 'ADMIN' && found.ownerId !== user.userId))
      throw notFound();
    req.houseId = found.houseId;
    return true;
  }
}
