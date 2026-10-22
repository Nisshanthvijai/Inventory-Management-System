import { Row } from '../common/database.types';

/** GET /users/me: the caller's profile plus the email from their token. */
export type MyProfile = Pick<Row<'profile'>, 'id' | 'full_name' | 'role' | 'is_active'> & {
  email?: string;
};

export type UserRow = Pick<Row<'profile'>, 'id' | 'full_name' | 'role' | 'is_active' | 'created_at'>;
