import { Session } from '../common/session';
import { StockRow } from './stock.types';

/** Reads and writes stock. Infrastructure provides the real one. */
export abstract class StockRepository {
  abstract list(session: Session): Promise<StockRow[]>;

  /** One stock row by its stock id, or null. */
  abstract findById(session: Session, stockId: string): Promise<StockRow | null>;

  /**
   * Sets the absolute quantity in one update (concurrent admins cannot lose each other's change).
   * Returns false if no row has this id. Throws RuleViolation / NotAllowed / UnexpectedError.
   */
  abstract setQuantity(session: Session, stockId: string, quantity: number): Promise<boolean>;
}
