import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiError } from '../common/errors';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

const id = () =>
  new ParseIntPipe({ exceptionFactory: () => new ApiError(404, 'NOT_FOUND') });

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list() {
    return this.users.list();
  }
  @Post() create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
  @Get(':userId') get(@Param('userId', id()) userId: number) {
    return this.users.get(userId);
  }
  @Patch(':userId') update(
    @CurrentUser() u: AuthUser,
    @Param('userId', id()) userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(u, userId, dto);
  }
  @Post(':userId/reset-password')
  @HttpCode(200)
  reset(@Param('userId', id()) userId: number, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(userId, dto.newPassword);
  }
}
