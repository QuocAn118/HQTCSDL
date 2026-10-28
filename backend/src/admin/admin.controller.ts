import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { IsUtcIso } from '../common/validation';
import { AnomalyService } from '../scheduler/anomaly.service';

class DetectDto {
  @IsUtcIso() nowUtc!: string;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly anomalies: AnomalyService) {}

  @Post('anomalies/detect')
  @HttpCode(200)
  async detect(@Body() dto: DetectDto) {
    return { newAlerts: await this.anomalies.detectNow(new Date(dto.nowUtc)) };
  }
}
