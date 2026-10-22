import { NotAllowed } from '../common/errors';

/** The profile fields an update may change. Same shape as UpdateUserDto. */
export interface ProfileChanges {
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

/**
 * Who may make this profile update. Returns the admin-only action it needs (it completes
 * "Only an admin can ..."), or null if callers may do it themselves (renaming their own profile).
 * Throws 403 if callers try to change their own role or active status: not even an admin may.
 */
export function adminActionForUserUpdate(
  changes: ProfileChanges,
  targetId: string,
  callerId: string,
): string | null {
  const changesAccess = changes.role !== undefined || changes.is_active !== undefined;
  if (changesAccess) {
    if (targetId === callerId) {
      throw new NotAllowed('You cannot change your own role or active status');
    }
    return 'change a role or deactivate a user';
  }
  if (targetId !== callerId) return "change another user's name";
  return null;
}
