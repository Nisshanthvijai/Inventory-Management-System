import { SupabaseClient } from '@supabase/supabase-js';

/** What the app layers need to get a database client. Infrastructure provides the real one. */
export abstract class DbFactory {
  /** Client with no user. Used for login and for checking a token. */
  abstract anon(): SupabaseClient;

  /** Client that acts as the user: their JWT is sent, so RLS applies. */
  abstract forUser(token: string): SupabaseClient;
}
