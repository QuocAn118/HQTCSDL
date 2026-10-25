import { Controller, Get, Optional, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, SkipDbCheck } from '../common/decorators';
import { MqttStatus } from '../common/status';
import { DbService } from '../db/db.service';

@Controller()
export class HealthController {
  constructor(
    private readonly db: DbService,
    @Optional() private readonly mqtt?: MqttStatus,
  ) {}

  // Cong khai, khong tra chi tiet nao khac (hop dong 3.3, spec backend 3.5).
  @Public()
  @SkipDbCheck()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const dbOk = this.db.isReady() && (await this.db.ping());
    const mqttOk = this.mqtt?.isConnected() ?? false;
    res.status(dbOk && mqttOk ? 200 : 503);
    return dbOk && mqttOk
      ? { status: 'ok', db: 'ok', mqtt: 'connected' }
      : {
          status: 'error',
          db: dbOk ? 'ok' : 'down',
          mqtt: mqttOk ? 'connected' : 'disconnected',
        };
  }
}
