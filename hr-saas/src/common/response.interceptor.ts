import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

// Unified response shell: { code, message, data }
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<any> {
    return next.handle().pipe(map((data) => ({ code: 0, message: 'ok', data: data ?? null })));
  }
}
