import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { Action, assertCan } from '../../domain/common/permissions';
import { isRole } from '../../domain/common/role';
import { UnexpectedError } from './errors';

/** Reads the caller's role and throws NotAllowed unless it may do the action (see PERMISSIONS). */
export async function requirePermission(
  db: SupabaseClient,
  user: AuthUser,
  action: Action,
  subject?: string,
) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new UnexpectedError(error.message);
  assertCan(isRole(data?.role) ? data.role : null, action, subject);
}
