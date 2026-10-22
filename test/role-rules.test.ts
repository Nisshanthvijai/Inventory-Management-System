import { ApiError } from '../src/domain/common/api-error';
import { assertAdmin, assertManagerOrAdmin } from '../src/domain/common/role-rules';

const statusOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiError ? e.getStatus() : 'not an ApiError';
  }
  return 'no error';
};

describe('assertAdmin', () => {
  it('lets an admin through', () => {
    expect(() => assertAdmin('admin', 'change stock')).not.toThrow();
  });

  it.each(['manager', 'requestor', null, undefined])('refuses %s with a 403', (role) => {
    expect(() => assertAdmin(role, 'change stock')).toThrow('Only an admin can change stock');
    expect(statusOf(() => assertAdmin(role, 'change stock'))).toBe(403);
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
    expect(statusOf(() => assertManagerOrAdmin(role, 'create a PO'))).toBe(403);
  });
});
