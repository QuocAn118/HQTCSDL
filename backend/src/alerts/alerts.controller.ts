import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { AlertsService } from './alerts.service';
import { ListAlertsQuery, UpdateAlertDto } from './dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListAlertsQuery) {
    return this.svc.list(u, q);
  }
  @Get(':alertId') get(@Param('alertId', ParseIntPipe) id: number) {
    return this.svc.get(id);
  }
  @Patch(':alertId') update(
    @CurrentUser() u: AuthUser,
    @Param('alertId', ParseIntPipe) id: number,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.svc.updateStatus(u, id, dto);
  }

  @Get(':alertId/snapshot')
  async snapshot(
    @Param('alertId', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return new StreamableFile(
      createReadStream(await this.svc.snapshotFile(id)),
      { type: 'image/jpeg' },
    );
  }
}
