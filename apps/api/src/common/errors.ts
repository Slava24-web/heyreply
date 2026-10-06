import { HttpException, HttpStatus } from '@nestjs/common';

/** Errors carry a stable `code` so the client can localize them. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message = code) {
    super({ code, message }, status);
  }
}
