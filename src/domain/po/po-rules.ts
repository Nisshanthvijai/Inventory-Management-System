import { ApiError } from '../common/api-error';

/** Throws 409 unless the PO is open: only an open PO can be cancelled. */
export function assertPoCancellable(poNo: string, status: string): void {
  if (status !== 'open') {
    throw new ApiError(409, `PO ${poNo} is ${status}; only an open PO can be cancelled`);
  }
}
