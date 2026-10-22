import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { NotAllowed, NotFound } from '../../domain/common/errors';
import { permissionForUserUpdate } from '../../domain/users/user-rules';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { UpdateUserDto } from './users.dto';
import { UsersRepository } from './users.repository';
import { MyProfile, UserRow } from './users.types';

/** Users are profiles; logins are created in the Supabase dashboard, not by this API. */
@Injectable()
export class UsersService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly users: UsersRepository,
  ) {}

  /** The signed-in user's own profile, plus the email from their token. */
  async me(session: Session, user: AuthUser): Promise<MyProfile> {
    // A failed read is our problem (500, from the repository); only a missing profile is a 403.
    const profile = await this.users.findProfile(session, user.id);
    if (!profile) throw new NotAllowed('No profile for this user');
    return { ...profile, email: user.email };
  }

  async list(session: Session, user: AuthUser): Promise<UserRow[]> {
    await this.permissions.require(session, user, 'user.list');
    return this.users.list(session);
  }

  async update(session: Session, user: AuthUser, id: string, dto: UpdateUserDto): Promise<UserRow> {
    const permission = permissionForUserUpdate(dto, id, user.id);
    if (permission) await this.permissions.require(session, user, permission);

    const row = await this.users.update(session, id, dto);
    if (!row) throw new NotFound('User not found');
    return row;
  }
}
