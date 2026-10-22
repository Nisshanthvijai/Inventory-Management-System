import { AppError } from '../../domain/common/errors';

/** Login failed: wrong email or password. */
export class Unauthenticated extends AppError {
  readonly kind = 'unauthenticated' as const;
}

/**
 * Something outside the rules failed, e.g. a database error. The message is for the log only:
 * the client gets a generic 500.
 */
export class UnexpectedError extends AppError {
  readonly kind = 'unexpected' as const;
}
