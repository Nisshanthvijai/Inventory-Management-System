import { Injectable } from '@nestjs/common';
import { Row } from '../../../application/common/database.types';
import { UnexpectedError } from '../../../application/common/errors';
import { Session } from '../../../application/common/session';
import { UpdateUserDto } from '../../../application/users/users.dto';
import { UsersRepository } from '../../../application/users/users.repository';
import { Profile, UserRow } from '../../../application/users/users.types';
import { NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

type ProfileRow = Row<'profile'>;
assertExact<Exact<UserRow, Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'is_active' | 'created_at'>>>();
assertExact<Exact<Profile, Pick<ProfileRow, 'id' | 'full_name' | 'role' | 'is_active'>>>();

const COLUMNS = 'id, full_name, role, is_active, created_at';

/** Users are rows in `profile`. Logins are created in the Supabase dashboard (no service_role key here). */
@Injectable()
export class SupabaseUsersRepository implements UsersRepository {
  async findProfile(session: Session, userId: string): Promise<Profile | null> {
    const { data, error } = await dbOf(session)
      .from('profile')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  async list(session: Session): Promise<UserRow[]> {
    const { data, error } = await dbOf(session).from('profile').select(COLUMNS).order('full_name');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }

  async update(session: Session, id: string, changes: UpdateUserDto): Promise<UserRow | null> {
    const { data, error } = await dbOf(session)
      .from('profile')
      .update(changes)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      // The profile_guard trigger repeats the role rules the service checks first.
      if (error.code === 'P0001' || error.code === '42501') throw new NotAllowed(error.message);
      if (error.code === '23514') throw new RuleViolation(error.message);
      throw new UnexpectedError(error.message);
    }
    return data;
  }
}
