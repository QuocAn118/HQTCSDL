import { applyDecorators } from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEVICE_TYPES = [
  'SENSOR',
  'MIST',
  'FAN',
  'HEATER',
  'SPEAKER',
  'CAMERA',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export class CreateHouseDto {
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsInt() @Min(1) ownerId?: number;
}
export class UpdateHouseDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateZoneDto {
  @IsString() @Length(1, 50) name!: string;
  @IsInt() @Min(0) @Max(255) floorNo!: number;
}
export class UpdateZoneDto {
  @IsOptional() @IsString() @Length(1, 50) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(255) floorNo?: number;
}
export class CreateDeviceDto {
  // Code noi vao topic MQTT va la client id: khop bieu thuc topic ([A-Z0-9-]+) cua test hop dong.
  @Matches(/^[A-Z0-9-]{3,50}$/) code!: string;
  @IsString() @Length(1, 100) name!: string;
  @IsIn(DEVICE_TYPES) deviceType!: DeviceType;
}
export class UpdateDeviceDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
// Cot DECIMAL(9,2): vuot thi SQL bao loi tran so -> 500 (T11W-2).
const THRESHOLD_LIMIT = 9999999.99;
const IsThreshold = () =>
  applyDecorators(
    IsOptional(),
    IsNumber(),
    Min(-THRESHOLD_LIMIT),
    Max(THRESHOLD_LIMIT),
  );

export class ThresholdDto {
  @IsThreshold() minValue?: number | null;
  @IsThreshold() maxValue?: number | null;
  @IsThreshold() targetValue?: number | null;
}
