import { NotAllowed } from '../src/domain/common/errors';
import { permissionForUserUpdate } from '../src/domain/users/user-rules';

const ME = 'user-me';
const OTHER = 'user-other';

describe('permissionForUserUpdate', () => {
  it('lets anyone rename their own profile', () => {
    expect(permissionForUserUpdate({ full_name: 'New Name' }, ME, ME)).toBeNull();
  });

  it("needs a permission to rename someone else's profile", () => {
    expect(permissionForUserUpdate({ full_name: 'New Name' }, OTHER, ME)).toBe('user.rename-other');
  });

  it.each([{ role: 'manager' }, { is_active: false }, { role: 'admin', full_name: 'X' }])(
    'needs a permission to change access on someone else: %o',
    (changes) => {
      expect(permissionForUserUpdate(changes, OTHER, ME)).toBe('user.change-access');
    },
  );

  it.each([{ role: 'admin' }, { is_active: false }, { is_active: true, full_name: 'X' }])(
    'refuses a change to your own access: %o',
    (changes) => {
      const run = () => permissionForUserUpdate(changes, ME, ME);
      expect(run).toThrow('You cannot change your own role or active status');
      expect(run).toThrow(NotAllowed);
    },
  );
});
