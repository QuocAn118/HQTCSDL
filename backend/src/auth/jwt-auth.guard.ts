import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../common/errors';
import { IS_PUBLIC } from '../common/decorators';
import type { AuthUser } from '../common/decorators';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers?: { authorization?: string }; user?: AuthUser }>();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    if (!m) throw new ApiError(401, 'UNAUTHENTICATED');
    req.user = await this.auth.verifyToken(m[1]);
    return true;
  }
}
