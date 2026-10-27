import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiError } from '../common/errors';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { PageQuery, toPage } from '../common/paging';
import * as pick from '../common/pickers';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { ControlDto } from './dto';

@Controller('devices/:deviceId')
export class ControlController {
  constructor(
    private readonly loop: ControlLoopService,
    private readonly db: DbService,
  ) {}

  @Post('control')
  @HttpCode(200)
  async control(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Body() dto: ControlDto,
    @CurrentUser() u: AuthUser,
  ) {
    if (dto.mode !== 'AUTO' && dto.isOn === undefined)
      throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['isOn'] });
    const current = await this.db.prisma.devices.findUnique({
      where: { DeviceId: deviceId },
      select: { IsOn: true, ZoneId: true },
    });
    // mode AUTO: isOn khong bat buoc, dien gia tri hien tai (hop dong 3.3); cam bien (IsOn NULL) -> SP bao 50003.
    const isOn = dto.isOn ?? current?.IsOn ?? false;
    const r = await this.loop.executeManual({
      deviceId,
      isOn,
      level: dto.level ?? null,
      source: 'MANUAL',
      mode: dto.mode ?? 'MANUAL',
      userId: u.userId,
      reason: dto.reason ?? null,
    });
    if (dto.mode === 'AUTO' && current)
      void this.loop.runZones([current.ZoneId]);
    return r;
  }

  @Get('control-logs')
  async logs(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Query() q: PageQuery,
  ) {
    const rows = await this.db.prisma.controlLogs.findMany({
      where: {
        DeviceId: deviceId,
        ...(q.before ? { LogId: { lt: q.before } } : {}),
      },
      orderBy: { LogId: 'desc' },
      take: q.limit + 1,
    });
    return toPage<(typeof rows)[number]>(
      rows,
      q.limit,
      (r) => r.LogId,
      pick.controlLog,
    );
  }
}
