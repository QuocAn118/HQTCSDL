import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import * as pick from '../common/pickers';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() @MaxLength(50) username!: string;
  @IsString() @MaxLength(200) password!: string;
}

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DbService,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('auth/me')
  async me(@CurrentUser() u: AuthUser) {
    return pick.user(
      await this.db.prisma.users.findUniqueOrThrow({
        where: { UserId: u.userId },
      }),
    );
  }
}
