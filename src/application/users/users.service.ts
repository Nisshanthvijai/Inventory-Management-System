import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { NotAllowed, NotFound, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { permissionForUserUpdate } from '../../domain/users/user-rules';
import { requirePermission } from '../common/roles';
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

    if (error) throw new NotAllowed(error.message);
    if (!data) throw new NotAllowed('No profile for this user');

    return { ...data, email: user.email };
  }

  async list(db: SupabaseClient, user: AuthUser) {
    await requirePermission(db, user, 'user.list');
    const { data, error } = await db.from('profile').select(COLUMNS).order('full_name');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }

  async update(db: SupabaseClient, user: AuthUser, id: string, dto: UpdateUserDto) {
    const permission = permissionForUserUpdate(dto, id, user.id);
    if (permission) await requirePermission(db, user, permission);

    const { data, error } = await db
      .from('profile')
      .update(dto)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      // The profile_guard trigger repeats the role rules above.
      if (error.code === 'P0001' || error.code === '42501') throw new NotAllowed(error.message);
      if (error.code === '23514') throw new RuleViolation(error.message);
      throw new UnexpectedError(error.message);
    }
    if (!data) throw new NotFound('User not found');
    return data;
  }
}
