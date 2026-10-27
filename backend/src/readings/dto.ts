import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches } from 'class-validator';
import { ApiError } from '../common/errors';
import { IsUtcIso, IsVnDate } from '../common/validation';

export class HistoryQuery {
  @Matches(/^[A-Z0-9]{1,10}$/) metric!: string;
  @IsUtcIso() from!: string;
  @IsUtcIso() to!: string;
  // Khong chan <= 0 o day: SP bao 50040 (hop dong 3.5).
  @IsOptional() @Type(() => Number) @IsInt() bucketMinutes: number = 60;
}

export class UtcRangeQuery {
  @IsUtcIso() from!: string;
  @IsUtcIso() to!: string;
}

export class VnRangeQuery {
  @IsVnDate() fromVnDate!: string;
  @IsVnDate() toVnDate!: string;
}

// Chuoi YYYY-MM-DD so sanh duoc theo thu tu tu dien; khong doi qua Date.
export function assertVnRange(q: VnRangeQuery): void {
  if (q.fromVnDate >= q.toVnDate)
    throw new ApiError(400, 'VALIDATION_ERROR', null, { fields: ['toVnDate'] });
}
