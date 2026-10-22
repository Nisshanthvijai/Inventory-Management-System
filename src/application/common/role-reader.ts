import { SupabaseClient } from '@supabase/supabase-js';
import { Role } from '../../domain/common/role';

/** Reads a user's role. Infrastructure provides the real one. */
export abstract class RoleReader {
  /**
   * The user's role, read with the caller's own client (so RLS applies).
   * null if they have no profile row. Throws UnexpectedError if the read fails.
   */
  abstract roleOf(db: SupabaseClient, userId: string): Promise<Role | null>;
}
