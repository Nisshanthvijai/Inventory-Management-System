import { Session } from '../common/session';
import { MyPoLine } from './po-lines.types';

/** Reads PO lines. Infrastructure provides the real one. */
export abstract class PoLinesRepository {
  /** The caller's own PO lines (for PRs they requested), without prices. */
  abstract mine(session: Session): Promise<MyPoLine[]>;
}
