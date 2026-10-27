import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { HistoryQuery, VnRangeQuery, assertVnRange } from './dto';

@Controller()
export class ReadingsController {
  constructor(
    private readonly sp: SpService,
    private readonly db: DbService,
  ) {}

  @Get('houses/:houseId/latest-readings')
  async latest(@Param('houseId', ParseIntPipe) houseId: number) {
    const rows = await this.db.prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      'SELECT HouseId, ZoneId, ZoneName, DeviceId, DeviceCode, DeviceStatus, MetricCode, Unit, Value, RecordedAt FROM dbo.vw_LatestReadings WHERE HouseId = @P1 ORDER BY ZoneId, MetricCode',
      houseId,
    );
    return rows.map(pick.latestReading);
  }

  @Get('zones/:zoneId/readings')
  async history(
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Query() q: HistoryQuery,
  ) {
    const rows = await this.sp.readingHistory(
      zoneId,
      q.metric,
      new Date(q.from),
      new Date(q.to),
      q.bucketMinutes,
    );
    return rows.map(pick.readingBucket);
  }

  @Get('zones/:zoneId/daily-stats')
  async dailyStats(
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Query() q: VnRangeQuery,
  ) {
    assertVnRange(q);
    const rows = await this.db.prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      'SELECT ZoneId, MetricCode, DayVn, AvgValue, MinValue, MaxValue, Samples FROM dbo.vw_DailyEnvStats WHERE ZoneId = @P1 AND DayVn >= @P2 AND DayVn < @P3 ORDER BY DayVn, MetricCode',
      zoneId,
      q.fromVnDate,
      q.toVnDate,
    );
    return rows.map(pick.dailyStats);
  }
}
