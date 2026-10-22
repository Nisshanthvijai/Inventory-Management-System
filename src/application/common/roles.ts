import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { assertAdmin, assertManagerOrAdmin } from '../../domain/common/role-rules';

/** Throws 403 unless the caller is an admin. `action` completes "Only an admin can ...". */
export async function requireAdmin(db: SupabaseClient, user: AuthUser, action: string) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  assertAdmin(data?.role, action);
}

/** Throws 403 unless the caller is a manager or admin. `action` completes "Only a manager or admin can ...". */
export async function requireManager(db: SupabaseClient, user: AuthUser, action: string) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  assertManagerOrAdmin(data?.role, action);
}
