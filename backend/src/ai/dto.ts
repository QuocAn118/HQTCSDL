import { IsIn, IsInt, IsNumber, Matches, Max, Min } from 'class-validator';
import { IsUtcIso } from '../common/validation';

export const CODE_RE = /^[A-Z0-9-]{3,50}$/;
export const MAX_BIRD_ITEMS = 500;

// Chi kiem kieu, Z, class; KHONG kiem so am va moc 5 phut de SP bao 50012/50014 (spec backend 5.3).
export class BirdCountItemDto {
  @Matches(CODE_RE) camera!: string;
  @IsUtcIso() windowStart!: string;
  @IsInt() in!: number;
  @IsInt() out!: number;
}

export class PredatorMetadataDto {
  @Matches(CODE_RE) camera!: string;
  @IsIn(['rat', 'snake', 'owl']) class!: string;
  @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsUtcIso() at!: string;
}

export class HeartbeatDto {
  @Matches(CODE_RE) device!: string;
  @IsUtcIso() at!: string;
}
