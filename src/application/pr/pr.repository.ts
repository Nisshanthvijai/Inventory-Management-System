import { Session } from '../common/session';
import { CreatePrDto } from './pr.dto';
import { PrCreated, PrLineView, PrSummary } from './pr.types';

/** Reads and creates PRs. Infrastructure provides the real one. */
export abstract class PrRepository {
  /** Creates the PR and its lines in one step. Throws RuleViolation / NotAllowed / UnexpectedError. */
  abstract create(session: Session, pr: CreatePrDto): Promise<PrCreated>;

  /** PRs the caller may see (RLS decides), newest first. */
  abstract list(session: Session): Promise<PrSummary[]>;

  /** One PR header, or null if it does not exist or the caller may not see it. */
  abstract findById(session: Session, id: string): Promise<PrSummary | null>;

  abstract findLines(session: Session, prId: string): Promise<PrLineView[]>;
}
