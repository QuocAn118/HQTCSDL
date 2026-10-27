import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ControlDto {
  @IsOptional() @IsBoolean() isOn?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) level?: number;
  @IsOptional() @IsIn(['AUTO', 'MANUAL']) mode?: 'AUTO' | 'MANUAL';
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
