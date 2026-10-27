import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiError } from '../common/errors';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import {
  CreateDeviceDto,
  CreateHouseDto,
  CreateZoneDto,
  ThresholdDto,
  UpdateDeviceDto,
  UpdateHouseDto,
  UpdateZoneDto,
} from './dto';
import { HousesService } from './houses.service';

@Controller()
export class HousesController {
  constructor(private readonly svc: HousesService) {}

  @Get('houses') list(@CurrentUser() u: AuthUser) {
    return this.svc.listHouses(u);
  }
  @Post('houses') create(
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateHouseDto,
  ) {
    return this.svc.createHouse(u, dto);
  }
  @Get('houses/:houseId') get(@Param('houseId', ParseIntPipe) id: number) {
    return this.svc.getHouse(id);
  }
  @Patch('houses/:houseId') update(
    @Param('houseId', ParseIntPipe) id: number,
    @Body() dto: UpdateHouseDto,
  ) {
    return this.svc.updateHouse(id, dto);
  }

  @Get('houses/:houseId/zones') zones(
    @Param('houseId', ParseIntPipe) id: number,
  ) {
    return this.svc.listZones(id);
  }
  @Post('houses/:houseId/zones') createZone(
    @Param('houseId', ParseIntPipe) id: number,
    @Body() dto: CreateZoneDto,
  ) {
    return this.svc.createZone(id, dto);
  }
  @Patch('zones/:zoneId') updateZone(
    @Param('zoneId', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.svc.updateZone(id, dto);
  }

  @Get('houses/:houseId/devices') devices(
    @Param('houseId', ParseIntPipe) id: number,
  ) {
    return this.svc.listDevices(id);
  }
  @Post('zones/:zoneId/devices') createDevice(
    @Param('zoneId', ParseIntPipe) id: number,
    @Body() dto: CreateDeviceDto,
  ) {
    return this.svc.createDevice(id, dto);
  }
  @Patch('devices/:deviceId') updateDevice(
    @Param('deviceId', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.svc.updateDevice(id, dto);
  }

  @Get('metrics') metrics() {
    return this.svc.metrics();
  }
  @Get('zones/:zoneId/thresholds') thresholds(
    @Param('zoneId', ParseIntPipe) id: number,
  ) {
    return this.svc.thresholds(id);
  }

  @Put('zones/:zoneId/thresholds/:metricCode')
  put(
    @CurrentUser() u: AuthUser,
    @Param('zoneId', ParseIntPipe) id: number,
    @Param('metricCode') metricCode: string,
    @Body() dto: ThresholdDto,
  ) {
    if (!/^[A-Z0-9]{1,10}$/.test(metricCode))
      throw new ApiError(404, 'NOT_FOUND');
    return this.svc.putThreshold(u, id, metricCode, dto);
  }
}
