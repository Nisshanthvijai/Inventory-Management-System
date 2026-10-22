import { ApiError } from './api-error';

/** Throws 403 unless the role is admin. `action` completes "Only an admin can ...". */
export function assertAdmin(role: string | null | undefined, action: string): void {
  if (role !== 'admin') throw new ApiError(403, `Only an admin can ${action}`);
}

/** Throws 403 unless the role is manager or admin. `action` completes "Only a manager or admin can ...". */
export function assertManagerOrAdmin(role: string | null | undefined, action: string): void {
  if (role !== 'manager' && role !== 'admin') {
    throw new ApiError(403, `Only a manager or admin can ${action}`);
  }
}
