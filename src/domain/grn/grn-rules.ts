import { ApiError } from '../common/api-error';

/**
 * Throws 403 unless this role may receive goods. A requestor or admin can; a manager cannot
 * (the database repeats this, and also requires a requestor to have a line on the PO).
 */
export function assertCanReceiveGoods(role: string | null | undefined): void {
  if (role === 'manager') {
    throw new ApiError(403, 'A manager cannot receive goods; a requestor or admin can');
  }
  if (role !== 'requestor' && role !== 'admin') {
    throw new ApiError(403, 'Only a requestor or admin can receive goods');
  }
}
