import { HttpException } from '@nestjs/common';

/** The one error type services throw. The filter turns it into JSON. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
