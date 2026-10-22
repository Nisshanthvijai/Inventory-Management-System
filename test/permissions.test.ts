import { NotAllowed } from '../src/domain/common/errors';
import { Action, assertCan, can, PERMISSIONS } from '../src/domain/common/permissions';
import { Role, ROLES } from '../src/domain/common/role';

// Who may do what, and the exact message when they may not. These messages are part of the API.
const EXPECTED: Record<Action, { allowed: Role[]; denied: string }> = {
  'stock.set': { allowed: ['admin'], denied: 'Only an admin can change stock' },
  'user.list': { allowed: ['manager', 'admin'], denied: 'Only a manager or admin can list users' },
  'user.change-access': {
    allowed: ['admin'],
    denied: 'Only an admin can change a role or deactivate a user',
  },
  'user.rename-other': { allowed: ['admin'], denied: "Only an admin can change another user's name" },
  'po.view': {
    allowed: ['manager', 'admin'],
    denied: 'Only a manager or admin can view POs; requestors should use GET /po-lines/mine',
  },
  'po.create': { allowed: ['manager', 'admin'], denied: 'Only a manager or admin can create a PO' },
  'po.cancel': { allowed: ['manager', 'admin'], denied: 'Only a manager or admin can cancel a PO' },
  'pr-line.decide': {
    allowed: ['manager', 'admin'],
    denied: 'Only a manager or admin can decide on a PR line',
  },
  'grn.create': { allowed: ['requestor', 'admin'], denied: 'Only a requestor or admin can receive goods' },
  'master.view-restricted': {
    allowed: ['manager', 'admin'],
    denied: 'Only a manager or admin can view vendors',
  },
  'master.write': { allowed: ['admin'], denied: 'Only an admin can create or change vendors' },
};

describe('PERMISSIONS', () => {
  it('has an expectation for every action', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  describe.each(Object.entries(EXPECTED) as [Action, { allowed: Role[]; denied: string }][])(
    '%s',
    (action, { allowed, denied }) => {
      it.each(ROLES.filter((r) => allowed.includes(r)))('lets %s through', (role) => {
        expect(can(role, action)).toBe(true);
        expect(() => assertCan(role, action, 'vendor')).not.toThrow();
      });

      // The manager on grn.create has its own message, tested below.
      const refused = ROLES.filter((r) => !allowed.includes(r) && !(action === 'grn.create' && r === 'manager'));
      it.each([...refused, null, undefined])('refuses %s with NotAllowed and the exact message', (role) => {
        expect(can(role, action)).toBe(false);
        expect(() => assertCan(role, action, 'vendor')).toThrow(NotAllowed);
        expect(() => assertCan(role, action, 'vendor')).toThrow(denied);
      });
    },
  );

  it('tells a manager why they cannot receive goods', () => {
    expect(() => assertCan('manager', 'grn.create')).toThrow(
      'A manager cannot receive goods; a requestor or admin can',
    );
  });

  it('fills {subject} with the subject', () => {
    expect(() => assertCan('requestor', 'master.write', 'item variant')).toThrow(
      'Only an admin can create or change item variants',
    );
  });
});
