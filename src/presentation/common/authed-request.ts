import { Db } from '../../application/common/db';
import { AuthUser } from '../../domain/common/auth-user';

/** The parts of the HTTP request the guard reads and fills in. */
export interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  token?: string;
  db?: Db;
}
