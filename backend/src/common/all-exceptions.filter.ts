import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { ApiError, DB_HEALTH, MESSAGES } from './errors';
import type { DbHealth } from './errors';
import {
  isConnectionError,
  isRequestTimeout,
  mapSqlError,
  sqlNumberOf,
} from '../db/sql-errors';

const HTTP_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  503: 'RETRY_LATER',
};

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpException) {
    const status = e.getStatus();
    const code = HTTP_CODES[status] ?? 'INTERNAL';
    // 400 cua Nest (JSON hong, ParseIntPipe...) khong co ten truong cu the.
    return new ApiError(
      code === 'INTERNAL' ? 500 : status,
      code,
      null,
      code === 'VALIDATION_ERROR' ? { fields: ['body'] } : null,
    );
  }
  if (isConnectionError(e) || isRequestTimeout(e))
    return new ApiError(503, 'RETRY_LATER');
  const n = sqlNumberOf(e);
  return n !== null ? mapSqlError(n) : new ApiError(500, 'INTERNAL');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Loi');

  constructor(
    @Optional() @Inject(DB_HEALTH) private readonly dbHealth?: DbHealth,
  ) {}

  catch(e: unknown, host: ArgumentsHost): void {
    const res = host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>();
    const req = host
      .switchToHttp()
      .getRequest<{ method?: string; route?: { path?: string } }>();
    const api = toApiError(e);
    if (
      api.code === 'RETRY_LATER' &&
      api.sqlNumber === null &&
      isConnectionError(e)
    )
      this.dbHealth?.reportFailure(e);
    // Chi log ma, route, code - khong log header, body, query (spec backend 2.3).
    if (api.status >= 500) {
      this.log.error(
        `${req?.method} ${req?.route?.path ?? '(khong co route)'} -> ${api.status} ${api.code}${api.sqlNumber ? ` sql ${api.sqlNumber}` : ''}: ${(e as Error)?.constructor?.name ?? typeof e}`,
      );
    }
    res.status(api.status).json({
      error: {
        code: api.code,
        message: MESSAGES[api.code] ?? MESSAGES.INTERNAL,
        sqlNumber: api.sqlNumber,
        details: api.details,
      },
    });
  }
}
