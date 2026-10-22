import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { Action, assertCan } from '../../domain/common/permissions';
import { RoleReader } from './role-reader';

/**
 * Checks permissions for use cases. The role is read only when a check runs, so a request
 * rejected earlier (bad body, bad id) never touches the database.
 */
@Injectable()
export class PermissionService {
  constructor(private readonly roles: RoleReader) {}

  /** Throws NotAllowed unless the caller may do the action (see PERMISSIONS). */
  async require(db: SupabaseClient, user: AuthUser, action: Action, subject?: string) {
    assertCan(await this.roles.roleOf(db, user.id), action, subject);
  }
}
