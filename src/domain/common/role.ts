/** Matches the profile_role_valid CHECK constraint in the database. */
export const ROLES = ['admin', 'manager', 'requestor'] as const;

export type Role = (typeof ROLES)[number];

/** True if the value is one of the known roles (e.g. a role read from the database). */
export function isRole(value: unknown): value is Role {
  return (ROLES as readonly unknown[]).includes(value);
}
