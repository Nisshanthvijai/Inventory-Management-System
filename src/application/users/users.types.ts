/** A user's profile row, as the users endpoints return it. */
export interface UserRow {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

/** The fields GET /users/me reads from the profile. */
export type Profile = Omit<UserRow, 'created_at'>;

/** GET /users/me: the caller's profile plus the email from their token. */
export type MyProfile = Profile & { email?: string };
