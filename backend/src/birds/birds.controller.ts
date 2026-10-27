import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { UtcRangeQuery, VnRangeQuery, assertVnRange } from '../readings/dto';

@Controller()
export class BirdsController {
  constructor(private readonly db: DbService) {}

  @Get('houses/:houseId/bird-flow')
  async flow(
    @Param('houseId', ParseIntPipe) houseId: number,
    @Query() q: VnRangeQuery,
  ) {
    assertVnRange(q);
    const rows = await this.db.prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      'SELECT HouseId, DayVn, InTotal, OutTotal, Net FROM dbo.vw_DailyBirdFlow WHERE HouseId = @P1 AND DayVn >= @P2 AND DayVn < @P3 ORDER BY DayVn',
      houseId,
      q.fromVnDate,
      q.toVnDate,
    );
    return rows.map(pick.birdFlow);
  }

  @Get('devices/:deviceId/bird-counts')
  async counts(
    @Param('deviceId', ParseIntPipe) cameraId: number,
    @Query() q: UtcRangeQuery,
  ) {
    const rows = await this.db.prisma.birdCounts.findMany({
      where: {
        CameraId: cameraId,
        WindowStart: { gte: new Date(q.from), lt: new Date(q.to) },
      },
      orderBy: { WindowStart: 'asc' },
    });
    return rows.map(pick.birdCount);
  }
}
