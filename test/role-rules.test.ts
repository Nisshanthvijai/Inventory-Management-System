import { AppError } from '../src/domain/common/errors';
import { assertAdmin, assertManagerOrAdmin } from '../src/domain/common/role-rules';

const statusOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.kind : 'not an AppError';
  }
  return 'no error';
};

describe('assertAdmin', () => {
  it('lets an admin through', () => {
    expect(() => assertAdmin('admin', 'change stock')).not.toThrow();
  });

  it.each(['manager', 'requestor', null, undefined])('refuses %s with a 403', (role) => {
    expect(() => assertAdmin(role, 'change stock')).toThrow('Only an admin can change stock');
    expect(statusOf(() => assertAdmin(role, 'change stock'))).toBe('not_allowed');
  });
});

describe('assertManagerOrAdmin', () => {
  it.each(['manager', 'admin'])('lets %s through', (role) => {
    expect(() => assertManagerOrAdmin(role, 'create a PO')).not.toThrow();
  });

  it.each(['requestor', null, undefined])('refuses %s with a 403', (role) => {
    expect(() => assertManagerOrAdmin(role, 'create a PO')).toThrow(
      'Only a manager or admin can create a PO',
    );
    expect(statusOf(() => assertManagerOrAdmin(role, 'create a PO'))).toBe('not_allowed');
  });
});
