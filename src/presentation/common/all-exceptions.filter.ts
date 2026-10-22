import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppError, ErrorKind } from '../../domain/common/errors';
import { ApiError } from './api-error';

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

/** The only place that knows which HTTP status each kind of app error becomes. */
const STATUS_BY_KIND: Record<ErrorKind, number> = {
  rule: HttpStatus.BAD_REQUEST,
  unauthenticated: HttpStatus.UNAUTHORIZED,
  not_allowed: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  unexpected: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** What a client sees for any 500: the real cause (often database text) only goes to the log. */
const GENERIC_MESSAGE = 'Something went wrong';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<JsonResponse>();

    if (exception instanceof AppError && exception.kind !== 'unexpected') {
      const status = STATUS_BY_KIND[exception.kind];
      res.status(status).json({
        statusCode: status,
        error: HttpStatus[status],
        message: exception.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const { message, details } = this.read(exception);
      res.status(status).json({
        statusCode: status,
        error: HttpStatus[status] ?? 'ERROR',
        message,
        ...(details !== undefined && { details }),
      });
      return;
    }

    // An UnexpectedError, or anything that is not an app or HTTP error.
    this.logger.error(exception);
    res.status(500).json({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: GENERIC_MESSAGE,
    });
  }

  private read(e: HttpException): { message: string; details?: unknown } {
    if (e instanceof ApiError) return { message: e.message, details: e.details };

    const body = e.getResponse();
    if (typeof body === 'string') return { message: body };

    const { message, issues } = body as { message?: unknown; issues?: unknown };
    return {
      message: typeof message === 'string' ? message : e.message,
      details: issues,
    };
  }
}
