import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const ROLES = ['ADMIN', 'OWNER'] as const;
type RoleDto = (typeof ROLES)[number];

export class CreateUserDto {
  @IsString() @Length(3, 50) username!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
  @IsString() @Length(1, 100) fullName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsIn(ROLES) role!: RoleDto;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(1, 100) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @IsOptional() @IsIn(ROLES) role?: RoleDto;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) newPassword!: string;
}
