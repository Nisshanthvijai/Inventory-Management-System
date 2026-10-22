import { DecisionFields } from '../../domain/pr-lines/pr-line-rules';
import { Session } from '../common/session';
import { PrLineView } from '../pr/pr.types';

/** Reads and decides PR lines. Infrastructure provides the real one. */
export abstract class PrLinesRepository {
  /** The quantity requested on this PR line (stock unit), or null if there is no such line. */
  abstract findRequestedQuantity(session: Session, id: string): Promise<number | null>;

  /**
   * Writes a decision. Returns false if the line was not updated (RLS said no).
   * Throws Conflict (already on a PO) / RuleViolation / NotAllowed / UnexpectedError.
   */
  abstract saveDecision(session: Session, id: string, fields: DecisionFields): Promise<boolean>;

  /** The line from v_pr_lines, with its new status and the PR's recalculated status. */
  abstract findLine(session: Session, id: string): Promise<PrLineView | null>;
}
