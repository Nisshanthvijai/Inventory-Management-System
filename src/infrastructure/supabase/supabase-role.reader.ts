import { Injectable } from '@nestjs/common';
import { UnexpectedError } from '../../application/common/errors';
import { RoleReader } from '../../application/common/role-reader';
import { Session } from '../../application/common/session';
import { isRole, Role } from '../../domain/common/role';
import { dbOf } from './supabase-session';

@Injectable()
export class SupabaseRoleReader implements RoleReader {
  async roleOf(session: Session, userId: string): Promise<Role | null> {
    const { data, error } = await dbOf(session)
      .from('profile')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return isRole(data?.role) ? data.role : null;
  }
}
