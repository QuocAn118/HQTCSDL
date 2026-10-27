import { Injectable, Logger } from '@nestjs/common';
import { ApiError } from '../common/errors';
import type { AuthUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { ControlCache } from '../control-loop/cache.service';
import { ControlLoopService } from '../control-loop/control-loop.service';
import { DbService } from '../db/db.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateDeviceDto,
  CreateHouseDto,
  CreateZoneDto,
  DeviceType,
  ThresholdDto,
  UpdateDeviceDto,
  UpdateHouseDto,
  UpdateZoneDto,
} from './dto';

// Trang thai dau khi INSERT (thoa CK_Devices_ActuatorState, spec backend 5.3).
export const INITIAL_STATE: Record<
  DeviceType,
  { mode: string | null; isOn: boolean | null; level: number | null }
> = {
  FAN: { mode: 'AUTO', isOn: false, level: 0 },
  MIST: { mode: 'AUTO', isOn: false, level: null },
  HEATER: { mode: 'AUTO', isOn: false, level: null },
  SPEAKER: { mode: 'AUTO', isOn: false, level: null },
  SENSOR: { mode: null, isOn: null, level: null },
  CAMERA: { mode: null, isOn: null, level: null },
};

const badField = (f: string) =>
  new ApiError(400, 'VALIDATION_ERROR', null, { fields: [f] });

@Injectable()
export class HousesService {
  private readonly log = new Logger('Nha');

  constructor(
    private readonly db: DbService,
    private readonly cache: ControlCache,
    private readonly loop: ControlLoopService,
    private readonly rt: RealtimeService,
  ) {}

  async listHouses(u: AuthUser) {
    const rows = await this.db.prisma.houses.findMany({
      where: u.role === 'ADMIN' ? {} : { OwnerId: u.userId },
      orderBy: { HouseId: 'asc' },
    });
    return rows.map(pick.house);
  }

  async createHouse(u: AuthUser, dto: CreateHouseDto) {
    // ownerId chi ADMIN duoc chi dinh; OWNER thi lay tu JWT (spec backend 5.3).
    if (u.role === 'OWNER' && dto.ownerId !== undefined)
      throw badField('ownerId');
    if (u.role === 'ADMIN' && dto.ownerId === undefined)
      throw badField('ownerId');
    const ownerId = u.role === 'ADMIN' ? (dto.ownerId as number) : u.userId;
    const h = await this.db.prisma.houses.create({
      data: { Name: dto.name, Address: dto.address ?? null, OwnerId: ownerId },
    });
    this.rt.houseActivated(h.HouseId, h.OwnerId);
    return pick.house(h);
  }

  async getHouse(id: number) {
    return pick.house(
      await this.db.prisma.houses.findUniqueOrThrow({ where: { HouseId: id } }),
    );
  }

  async updateHouse(id: number, dto: UpdateHouseDto) {
    const h = await this.db.prisma.houses.update({
      where: { HouseId: id },
      data: { Name: dto.name, Address: dto.address, IsActive: dto.isActive },
    });
    if (dto.isActive === false) this.rt.houseDeactivated(id);
    if (dto.isActive === true) this.rt.houseActivated(id, h.OwnerId);
    if (dto.isActive !== undefined) await this.cache.load(); // bo/nap lai toan bo khu vuc, thiet bi cua nha
    return pick.house(h);
  }

  async listZones(houseId: number) {
    return (
      await this.db.prisma.zones.findMany({
        where: { HouseId: houseId },
        orderBy: { ZoneId: 'asc' },
      })
    ).map(pick.zone);
  }

  async createZone(houseId: number, dto: CreateZoneDto) {
    const z = await this.db.prisma.zones.create({
      data: { HouseId: houseId, Name: dto.name, FloorNo: dto.floorNo },
    });
    this.cache.addZone(z.ZoneId, houseId);
    return pick.zone(z);
  }

  async updateZone(zoneId: number, dto: UpdateZoneDto) {
    return pick.zone(
      await this.db.prisma.zones.update({
        where: { ZoneId: zoneId },
        data: { Name: dto.name, FloorNo: dto.floorNo },
      }),
    );
  }

  async listDevices(houseId: number) {
    return (
      await this.db.prisma.devices.findMany({
        where: { Zone: { HouseId: houseId } },
        orderBy: { DeviceId: 'asc' },
      })
    ).map(pick.device);
  }

  // Devices co trigger -> khong dung prisma.devices.create/update (R1, hop dong 3.2).
  async createDevice(zoneId: number, dto: CreateDeviceDto) {
    const s = INITIAL_STATE[dto.deviceType];
    const [row] = await this.db.prisma.$queryRawUnsafe<
      Array<{ DeviceId: number }>
    >(
      `DECLARE @t TABLE (DeviceId INT);
       INSERT INTO dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
       OUTPUT INSERTED.DeviceId INTO @t
       VALUES (@P1, @P2, @P3, @P4, @P5, @P6, @P7);
       SELECT DeviceId FROM @t;`,
      zoneId,
      dto.code,
      dto.name,
      dto.deviceType,
      s.mode,
      s.isOn,
      s.level,
    );
    await this.cache.reloadDevice(row.DeviceId);
    return pick.device(
      await this.db.prisma.devices.findUniqueOrThrow({
        where: { DeviceId: row.DeviceId },
      }),
    );
  }

  async updateDevice(deviceId: number, dto: UpdateDeviceDto) {
    await this.db.prisma.$executeRawUnsafe(
      'UPDATE dbo.Devices SET Name = COALESCE(@P1, Name), IsActive = COALESCE(@P2, IsActive) WHERE DeviceId = @P3',
      dto.name ?? null,
      dto.isActive ?? null,
      deviceId,
    );
    if (dto.isActive === false) this.cache.removeDevice(deviceId);
    if (dto.isActive === true) await this.cache.reloadDevice(deviceId);
    return pick.device(
      await this.db.prisma.devices.findUniqueOrThrow({
        where: { DeviceId: deviceId },
      }),
    );
  }

  async metrics() {
    return (
      await this.db.prisma.metrics.findMany({ orderBy: { MetricCode: 'asc' } })
    ).map(pick.metric);
  }

  async thresholds(zoneId: number) {
    return (
      await this.db.prisma.thresholds.findMany({
        where: { ZoneId: zoneId },
        orderBy: { MetricCode: 'asc' },
      })
    ).map(pick.threshold);
  }

  async putThreshold(
    u: AuthUser,
    zoneId: number,
    metricCode: string,
    dto: ThresholdDto,
  ) {
    const values = {
      MinValue: dto.minValue ?? null,
      MaxValue: dto.maxValue ?? null,
      TargetValue: dto.targetValue ?? null,
      UpdatedBy: u.userId,
    };
    // Thresholds khong co trigger -> Prisma upsert duoc; Min >= Max -> CHECK 547 -> CONSTRAINT_VIOLATION.
    const t = await this.db.prisma.thresholds.upsert({
      where: { ZoneId_MetricCode: { ZoneId: zoneId, MetricCode: metricCode } },
      update: { ...values, UpdatedAt: new Date() },
      create: { ZoneId: zoneId, MetricCode: metricCode, ...values },
    });
    await this.cache.reloadThresholds(zoneId);
    this.loop
      .runZones([zoneId])
      .catch((e: Error) =>
        this.log.error(`Chay vong sau PUT nguong loi: ${e.message}`),
      );
    return pick.threshold(t);
  }
}
