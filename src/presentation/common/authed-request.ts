import { Session } from '../../application/common/session';
import { AuthUser } from '../../domain/common/auth-user';

/** The parts of the HTTP request the guard reads and fills in. */
export interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  session?: Session;
}
