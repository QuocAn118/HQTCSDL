import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { ROLES } from '../common/decorators';
import type { AuthUser, Role } from '../common/decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const role = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
      .user?.role;
    if (!role || !roles.includes(role)) throw new ApiError(403, 'FORBIDDEN');
    return true;
  }
}
