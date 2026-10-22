import { Role } from '../../domain/common/role';
import { Session } from './session';

/** Reads a user's role. Infrastructure provides the real one. */
export abstract class RoleReader {
  /**
   * The user's role, read in the caller's own session (so RLS applies).
   * null if they have no profile row. Throws UnexpectedError if the read fails.
   */
  abstract roleOf(session: Session, userId: string): Promise<Role | null>;
}
