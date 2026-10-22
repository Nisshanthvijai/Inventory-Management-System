/**
 * The kinds of failure the app reports on purpose. Plain TypeScript, no framework:
 * the presentation layer decides how each kind is shown (the filter maps it to an HTTP status).
 */
export type ErrorKind =
  | 'rule'
  | 'unauthenticated'
  | 'not_allowed'
  | 'not_found'
  | 'conflict'
  | 'unexpected';

export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A business rule says no (e.g. approving more than was requested). */
export class RuleViolation extends AppError {
  readonly kind = 'rule' as const;
}

/** The caller is known but may not do this (e.g. a requestor creating a PO). */
export class NotAllowed extends AppError {
  readonly kind = 'not_allowed' as const;
}

/** The thing asked for does not exist (or RLS hides it). */
export class NotFound extends AppError {
  readonly kind = 'not_found' as const;
}

/** The request clashes with the current state (e.g. cancelling a PO that is not open). */
export class Conflict extends AppError {
  readonly kind = 'conflict' as const;
}
