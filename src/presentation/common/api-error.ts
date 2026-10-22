import { HttpException } from '@nestjs/common';

/** An HTTP error raised by the presentation layer itself (e.g. ZodPipe's 400 with details). */
export class ApiError extends HttpException {
  constructor(
    status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
