/**
 * "The database, acting as one signed-in user" (so RLS applies). Opaque on purpose: use cases
 * pass it to repositories but cannot see or use what is inside. Infrastructure makes the real one.
 */
export abstract class Session {
  /** Makes Session nominal: only subclasses (made by infrastructure) count as a Session. */
  protected readonly kind = 'session' as const;
}

/** Opens a Session for a user's token. Infrastructure provides the real one. */
export abstract class SessionFactory {
  abstract forUser(token: string): Session;
}
