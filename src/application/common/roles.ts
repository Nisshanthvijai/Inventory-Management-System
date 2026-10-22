import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';

/** Throws 403 unless the caller is an admin. `action` completes "Only an admin can ...". */
export async function requireAdmin(db: SupabaseClient, user: AuthUser, action: string) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (data?.role !== 'admin') throw new ApiError(403, `Only an admin can ${action}`);
}

/** Throws 403 unless the caller is a manager or admin. `action` completes "Only a manager or admin can ...". */
export async function requireManager(db: SupabaseClient, user: AuthUser, action: string) {
  const { data, error } = await db.from('profile').select('role').eq('id', user.id).maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (data?.role !== 'manager' && data?.role !== 'admin') {
    throw new ApiError(403, `Only a manager or admin can ${action}`);
  }
}
