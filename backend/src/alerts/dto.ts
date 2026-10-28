import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../common/paging';

export const ALERT_TYPES = [
  'THRESHOLD',
  'PREDATOR',
  'DEVICE_OFFLINE',
  'POPULATION_DROP',
] as const;

export class ListAlertsQuery extends PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) houseId?: number;
  @IsOptional()
  @Matches(/^(NEW|ACK|RESOLVED)(,(NEW|ACK|RESOLVED))*$/)
  status?: string;
  @IsOptional() @IsIn(ALERT_TYPES) type?: string;
}

export class UpdateAlertDto {
  @IsIn(['ACK', 'RESOLVED']) status!: 'ACK' | 'RESOLVED';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
