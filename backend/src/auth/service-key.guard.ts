import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { ApiError } from '../common/errors';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest();

// Bam ca hai roi so timingSafeEqual (hai gia tri bam cung do dai); khong bao gio log khoa (spec backend 5.1).
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  private readonly expected: Buffer;
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.expected = sha(cfg.aiServiceKey);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const got = ctx
      .switchToHttp()
      .getRequest<{ headers?: Record<string, unknown> }>().headers?.[
      'x-service-key'
    ];
    if (typeof got !== 'string' || !timingSafeEqual(sha(got), this.expected))
      throw new ApiError(401, 'UNAUTHENTICATED');
    return true;
  }
}
