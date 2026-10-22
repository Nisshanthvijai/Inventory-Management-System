import { NotAllowed } from './errors';

/** Throws 403 unless the role is admin. `action` completes "Only an admin can ...". */
export function assertAdmin(role: string | null | undefined, action: string): void {
  if (role !== 'admin') throw new NotAllowed(`Only an admin can ${action}`);
}

/** Throws 403 unless the role is manager or admin. `action` completes "Only a manager or admin can ...". */
export function assertManagerOrAdmin(role: string | null | undefined, action: string): void {
  if (role !== 'manager' && role !== 'admin') {
    throw new NotAllowed(`Only a manager or admin can ${action}`);
  }
}
