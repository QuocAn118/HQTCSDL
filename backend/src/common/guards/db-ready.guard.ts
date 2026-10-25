import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors';
import { SKIP_DB } from '../decorators';
import { DbService } from '../../db/db.service';

// Spec backend 3.1: cong HTTP mo ngay; route can CSDL tra 503 toi khi CSDL san sang (ke ca login).
@Injectable()
export class DbReadyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_DB, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    if (!this.db.isReady()) throw new ApiError(503, 'RETRY_LATER');
    return true;
  }
}
