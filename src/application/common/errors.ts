import { AppError } from '../../domain/common/errors';

/** Login failed: wrong email or password. */
export class Unauthenticated extends AppError {
  readonly kind = 'unauthenticated' as const;
}

/** Something outside the rules failed, e.g. a database error. */
export class UnexpectedError extends AppError {
  readonly kind = 'unexpected' as const;
}
