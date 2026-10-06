import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const obj = typeof body === 'string' ? { message: body } : (body as Record<string, unknown>);
      res.status(status).json({
        statusCode: status,
        code: obj.code ?? (status === 429 ? 'TOO_MANY_REQUESTS' : status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR'),
        message: obj.message ?? exception.message,
        details: obj.details ?? null,
      });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', details: null });
  }
}
