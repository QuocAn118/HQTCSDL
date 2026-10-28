import {
  Body,
  Controller,
  HttpCode,
  ParseArrayPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ValidationError } from 'class-validator';
import { ServiceKeyGuard } from '../auth/service-key.guard';
import { ApiError } from '../common/errors';
import { Public } from '../common/decorators';
import { validationError } from '../common/validation';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { BirdCountItemDto, MAX_BIRD_ITEMS } from './dto';
import { PredatorService } from './predator.service';

export const birdCountsPipe = new ParseArrayPipe({
  items: BirdCountItemDto,
  whitelist: true,
  forbidNonWhitelisted: true,
  // Body khong phai mang -> ParseArrayPipe goi voi chuoi thong bao, khong phai ValidationError[].
  exceptionFactory: (e: unknown) =>
    Array.isArray(e)
      ? validationError(e as ValidationError[])
      : new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['body'] }),
});

// AI khong dung JWT: chi X-Service-Key (hop dong 1.x, spec backend 5.1).
@Public()
@UseGuards(ServiceKeyGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly sp: SpService,
    private readonly db: DbService,
    private readonly rt: RealtimeService,
    private readonly predator: PredatorService,
  ) {}

  @Post('bird-counts')
  @HttpCode(200)
  async birdCounts(@Body(birdCountsPipe) items: BirdCountItemDto[]) {
    if (!items.length)
      throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['body'] });
    if (items.length > MAX_BIRD_ITEMS)
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE');
    const r = await this.sp.recordBirdCount(
      items.map((i) => ({
        camera: i.camera,
        windowStart: i.windowStart,
        in: i.in,
        out: i.out,
      })),
    );
    if (r.windowsUpserted > 0) {
      const codes = [...new Set(items.map((i) => i.camera))];
      const cams = await this.db.prisma.devices.findMany({
        where: { Code: { in: codes } },
        select: { DeviceId: true, Zone: { select: { HouseId: true } } },
      });
      for (const c of cams)
        this.rt.emitToHouse(c.Zone.HouseId, 'birdcount.updated', {
          houseId: c.Zone.HouseId,
          cameraId: c.DeviceId,
        });
    }
    return r;
  }

  @Post('predator-detections')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image'))
  predatorDetection(
    @Body('metadata') metadata: unknown,
    @UploadedFile() image?: { buffer: Buffer },
  ) {
    return this.predator.handle(metadata, image);
  }
}
