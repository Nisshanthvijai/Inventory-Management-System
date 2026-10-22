import { NotAllowed } from '../common/errors';
import { Role } from '../common/role';

/**
 * Throws NotAllowed unless this role may receive goods. A requestor or admin can; a manager cannot
 * (the database repeats this, and also requires a requestor to have a line on the PO).
 */
export function assertCanReceiveGoods(role: Role | null | undefined): void {
  if (role === 'manager') {
    throw new NotAllowed('A manager cannot receive goods; a requestor or admin can');
  }
  if (role !== 'requestor' && role !== 'admin') {
    throw new NotAllowed('Only a requestor or admin can receive goods');
  }
}
