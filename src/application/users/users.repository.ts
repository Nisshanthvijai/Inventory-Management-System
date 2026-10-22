import { Session } from '../common/session';
import { UpdateUserDto } from './users.dto';
import { Profile, UserRow } from './users.types';

/** Reads and writes user profiles. Infrastructure provides the real one. */
export abstract class UsersRepository {
  /** The profile of this user, or null if they have none. */
  abstract findProfile(session: Session, userId: string): Promise<Profile | null>;

  abstract list(session: Session): Promise<UserRow[]>;

  /** Applies the changes; null if no user has this id. Throws NotAllowed / RuleViolation / UnexpectedError. */
  abstract update(session: Session, id: string, changes: UpdateUserDto): Promise<UserRow | null>;
}
