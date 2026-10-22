import { NotAllowed } from './errors';
import { Role } from './role';

interface Rule {
  roles: readonly Role[];
  /** The message when the role is not allowed. `{subject}` is replaced by the subject, if given. */
  denied: string;
  /** A more specific message for one role, e.g. why a manager cannot receive goods. */
  deniedFor?: Partial<Record<Role, string>>;
}

const ADMIN: readonly Role[] = ['admin'];
const MANAGER_OR_ADMIN: readonly Role[] = ['manager', 'admin'];

/**
 * Who may do what. The one place to change when a role's rights change.
 * The database repeats these rules (RLS, triggers); this gives a clear 403 first.
 */
export const PERMISSIONS = {
  'stock.set': { roles: ADMIN, denied: 'Only an admin can change stock' },

  'user.list': { roles: MANAGER_OR_ADMIN, denied: 'Only a manager or admin can list users' },
  'user.change-access': {
    roles: ADMIN,
    denied: 'Only an admin can change a role or deactivate a user',
  },
  'user.rename-other': { roles: ADMIN, denied: "Only an admin can change another user's name" },

  'po.view': {
    roles: MANAGER_OR_ADMIN,
    denied: 'Only a manager or admin can view POs; requestors should use GET /po-lines/mine',
  },
  'po.create': { roles: MANAGER_OR_ADMIN, denied: 'Only a manager or admin can create a PO' },
  'po.cancel': { roles: MANAGER_OR_ADMIN, denied: 'Only a manager or admin can cancel a PO' },

  'pr-line.decide': {
    roles: MANAGER_OR_ADMIN,
    denied: 'Only a manager or admin can decide on a PR line',
  },

  'grn.create': {
    roles: ['requestor', 'admin'],
    denied: 'Only a requestor or admin can receive goods',
    deniedFor: { manager: 'A manager cannot receive goods; a requestor or admin can' },
  },

  'master.view-restricted': {
    roles: MANAGER_OR_ADMIN,
    denied: 'Only a manager or admin can view {subject}s',
  },
  'master.write': { roles: ADMIN, denied: 'Only an admin can create or change {subject}s' },
} satisfies Record<string, Rule>;

export type Action = keyof typeof PERMISSIONS;

/** True if this role may do the action. */
export function can(role: Role | null | undefined, action: Action): boolean {
  const rule: Rule = PERMISSIONS[action];
  return role != null && rule.roles.includes(role);
}

/** Throws NotAllowed unless this role may do the action. `subject` fills `{subject}`, e.g. "vendor". */
export function assertCan(role: Role | null | undefined, action: Action, subject?: string): void {
  if (can(role, action)) return;
  const rule: Rule = PERMISSIONS[action];
  const message = (role != null && rule.deniedFor?.[role]) || rule.denied;
  throw new NotAllowed(subject === undefined ? message : message.replace('{subject}', subject));
}
