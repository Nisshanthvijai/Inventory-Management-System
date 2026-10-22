import { Conflict } from '../common/errors';
import { PoStatus } from './po-status';

/** Throws Conflict unless the PO is open: only an open PO can be cancelled. */
export function assertPoCancellable(poNo: string, status: PoStatus): void {
  if (status !== 'open') {
    throw new Conflict(`PO ${poNo} is ${status}; only an open PO can be cancelled`);
  }
}
