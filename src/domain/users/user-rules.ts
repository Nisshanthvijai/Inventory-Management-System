import { NotAllowed } from '../common/errors';
import { Action } from '../common/permissions';

/** The profile fields an update may change. Same shape as UpdateUserDto. */
export interface ProfileChanges {
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

/**
 * Which permission this profile update needs, or null if callers may do it themselves
 * (renaming their own profile). Throws NotAllowed if callers try to change their own role
 * or active status: not even an admin may.
 */
export function permissionForUserUpdate(
  changes: ProfileChanges,
  targetId: string,
  callerId: string,
): Action | null {
  const changesAccess = changes.role !== undefined || changes.is_active !== undefined;
  if (changesAccess) {
    if (targetId === callerId) {
      throw new NotAllowed('You cannot change your own role or active status');
    }
    return 'user.change-access';
  }
  if (targetId !== callerId) return 'user.rename-other';
  return null;
}
