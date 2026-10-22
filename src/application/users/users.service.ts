import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { requireAdmin, requireManager } from '../common/roles';
import { UpdateUserDto } from './users.dto';

const COLUMNS = 'id, full_name, role, is_active, created_at';

/**
 * Users are rows in `profile`. Creating a login needs Supabase's admin API (the
 * service_role key), which this API never uses, so users are created in the dashboard.
 */
@Injectable()
export class UsersService {
  /** The signed-in user's own profile, plus the email from their token. */
  async me(db: SupabaseClient, user: AuthUser) {
    const { data, error } = await db
      .from('profile')
      .select('id, full_name, role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw new ApiError(403, error.message);
    if (!data) throw new ApiError(403, 'No profile for this user');

    return { ...data, email: user.email };
  }

  async list(db: SupabaseClient, user: AuthUser) {
    await requireManager(db, user, 'list users');
    const { data, error } = await db.from('profile').select(COLUMNS).order('full_name');
    if (error) throw new ApiError(500, error.message);
    return data ?? [];
  }

  async update(db: SupabaseClient, user: AuthUser, id: string, dto: UpdateUserDto) {
    const changesAccess = dto.role !== undefined || dto.is_active !== undefined;
    if (changesAccess) {
      if (id === user.id) throw new ApiError(403, 'You cannot change your own role or active status');
      await requireAdmin(db, user, 'change a role or deactivate a user');
    } else if (id !== user.id) {
      await requireAdmin(db, user, "change another user's name");
    }

    const { data, error } = await db
      .from('profile')
      .update(dto)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      // The profile_guard trigger repeats the role rules above.
      if (error.code === 'P0001' || error.code === '42501') throw new ApiError(403, error.message);
      if (error.code === '23514') throw new ApiError(400, error.message);
      throw new ApiError(500, error.message);
    }
    if (!data) throw new ApiError(404, 'User not found');
    return data;
  }
}
