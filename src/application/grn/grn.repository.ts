import { Session } from '../common/session';
import { CreateGrnDto } from './grn.dto';
import { GrnCreated, GrnListItem } from './grn.types';

/** Reads and creates goods receipts. Infrastructure provides the real one. */
export abstract class GrnRepository {
  /**
   * Creates the GRN and its lines in one step. Quantity limits, "already complete" and
   * "PO must be open" are enforced by the database. Throws Conflict / RuleViolation /
   * NotAllowed / UnexpectedError.
   */
  abstract create(session: Session, grn: CreateGrnDto): Promise<GrnCreated>;

  /** Receipts the caller may see (RLS: a requestor's own, or all for a manager or admin). */
  abstract list(session: Session): Promise<GrnListItem[]>;
}
