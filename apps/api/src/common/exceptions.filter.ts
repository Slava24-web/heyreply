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
    // Errors thrown by Express body parsing (too large, bad encoding) carry their own 4xx status; they are client mistakes, not crashes
    const status = (exception as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500 && (exception as { expose?: unknown }).expose === true) {
      const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      res.status(status).json({ statusCode: status, code, message: status === 413 ? 'Request body too large' : 'Bad request', details: null });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', details: null });
  }
}
