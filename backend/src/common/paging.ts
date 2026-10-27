import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Phan trang theo con tro id (hop dong 3.1).
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit: number =
    50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) before?: number;
}

export function toPage<T>(
  rows: T[],
  limit: number,
  idOf: (r: T) => number,
  map: (r: T) => unknown,
) {
  const items = rows.slice(0, limit);
  return {
    items: items.map(map),
    nextBefore:
      rows.length > limit && items.length
        ? idOf(items[items.length - 1])
        : null,
  };
}
