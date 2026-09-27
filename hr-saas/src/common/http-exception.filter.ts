import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      const message = typeof body === 'string' ? body : (body.message ?? exception.message);
      res.status(status).json({ code: status, message: Array.isArray(message) ? message.join('; ') : message, data: null });
      return;
    }
    const message = exception instanceof Error ? exception.message : 'internal error';
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: 500, message, data: null });
  }
}
