import { Session } from '../common/session';
import { MasterKey } from './master.resources';

/**
 * Generic reads and writes for every master-data resource. Infrastructure provides the real one
 * (and knows which table each key is). Rows are returned as the database sends them.
 */
export abstract class MasterRepository {
  abstract list(session: Session, key: MasterKey): Promise<unknown[]>;

  /** Throws Conflict / RuleViolation / NotAllowed / UnexpectedError. */
  abstract create(session: Session, key: MasterKey, values: object): Promise<unknown>;

  /** null if no row has this id. Throws Conflict / RuleViolation / NotAllowed / UnexpectedError. */
  abstract update(session: Session, key: MasterKey, id: string, values: object): Promise<unknown | null>;
}
