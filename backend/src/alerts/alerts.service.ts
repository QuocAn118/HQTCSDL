import { Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import type { AuthUser } from '../common/decorators';
import { toPage } from '../common/paging';
import * as pick from '../common/pickers';
import { ownerOf } from '../auth/ownership.guard';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { ListAlertsQuery, UpdateAlertDto } from './dto';

const notFound = () => new ApiError(404, 'NOT_FOUND');

// Duong dan sau ghep phai nam trong storage/ (spec backend 5.6); khong bao gio nhan duong dan tu client.
export function resolveSnapshot(
  storageRoot: string,
  snapshotPath: string | null,
): string | null {
  if (
    !snapshotPath ||
    isAbsolute(snapshotPath) ||
    /^[A-Za-z]:/.test(snapshotPath)
  )
    return null;
  const root = resolve(storageRoot);
  const full = resolve(root, snapshotPath);
  return full.startsWith(root + sep) ? full : null;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly rt: RealtimeService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async list(u: AuthUser, q: ListAlertsQuery) {
    if (q.houseId !== undefined) {
      const h = await ownerOf(this.db, 'houseId', q.houseId);
      if (!h || (u.role !== 'ADMIN' && h.ownerId !== u.userId))
        throw notFound();
    }
    const where = {
      ...(q.houseId !== undefined
        ? { HouseId: q.houseId }
        : u.role === 'ADMIN'
          ? {}
          : { House: { OwnerId: u.userId } }),
      ...(q.status ? { Status: { in: q.status.split(',') } } : {}),
      ...(q.type ? { AlertType: q.type } : {}),
      ...(q.before ? { AlertId: { lt: q.before } } : {}),
    };
    const rows = await this.db.prisma.alerts.findMany({
      where,
      orderBy: { AlertId: 'desc' },
      take: q.limit + 1,
    });
    return toPage<(typeof rows)[number]>(
      rows,
      q.limit,
      (r) => r.AlertId,
      pick.alert,
    );
  }

  async get(id: number) {
    const a = await this.db.prisma.alerts.findUnique({
      where: { AlertId: id },
      include: { History: { orderBy: { HistoryId: 'asc' } } },
    });
    if (!a) throw notFound();
    return pick.alertWithHistory(a);
  }

  async updateStatus(u: AuthUser, id: number, dto: UpdateAlertDto) {
    const r = await this.sp.updateAlertStatus(
      id,
      dto.status,
      u.userId,
      dto.note ?? null,
    );
    this.rt.emitToHouse(Number(r.HouseId), 'alert.updated', {
      alertId: r.AlertId,
      houseId: r.HouseId,
      status: r.Status,
      resolvedAt: r.ResolvedAt,
      resolvedBy: r.ResolvedBy,
    });
    return pick.alertStatus(r);
  }

  async snapshotFile(id: number): Promise<string> {
    const a = await this.db.prisma.alerts.findUnique({
      where: { AlertId: id },
      select: { SnapshotPath: true },
    });
    const full = resolveSnapshot(this.cfg.storageRoot, a?.SnapshotPath ?? null);
    if (!full || !existsSync(full)) throw notFound();
    return full;
  }
}
