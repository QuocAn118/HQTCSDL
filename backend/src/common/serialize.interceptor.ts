import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { assertSerialized, serialize } from './serialize';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body instanceof StreamableFile || Buffer.isBuffer(body))
          return body;
        const out = serialize(body);
        if (process.env.NODE_ENV === 'test') assertSerialized(out);
        return out;
      }),
    );
  }
}
