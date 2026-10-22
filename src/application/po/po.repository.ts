import { Session } from '../common/session';
import { CreatePoDto } from './po.dto';
import { OrderContext, PoCreated, PoForCancel, PoLineView, PoSummary } from './po.types';

/** Reads, creates and cancels POs. Infrastructure provides the real one. */
export abstract class PoRepository {
  /** All POs with totals, newest first. */
  abstract list(session: Session): Promise<PoSummary[]>;

  /** One PO header with totals, or null. */
  abstract findSummary(session: Session, id: string): Promise<PoSummary | null>;

  abstract findLines(session: Session, poId: string): Promise<PoLineView[]>;

  /** The PO's number and status, or null if there is no such PO. */
  abstract findForCancel(session: Session, id: string): Promise<PoForCancel | null>;

  /**
   * Cancels the PO only if it is still open. Returns false if it changed since it was read.
   * Throws Conflict (e.g. goods received) / NotAllowed / UnexpectedError.
   */
  abstract cancelIfOpen(session: Session, id: string): Promise<boolean>;

  /** The PR lines, their variants' units, and what is already ordered on other POs. */
  abstract loadOrderContext(session: Session, prLineIds: string[]): Promise<OrderContext>;

  /** Creates the PO and its lines in one step. Throws NotFound / RuleViolation / Conflict / NotAllowed / UnexpectedError. */
  abstract create(session: Session, po: CreatePoDto): Promise<PoCreated>;
}
