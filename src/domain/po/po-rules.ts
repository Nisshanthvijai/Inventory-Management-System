import { Conflict } from '../common/errors';

/** Throws 409 unless the PO is open: only an open PO can be cancelled. */
export function assertPoCancellable(poNo: string, status: string): void {
  if (status !== 'open') {
    throw new Conflict(`PO ${poNo} is ${status}; only an open PO can be cancelled`);
  }
}
