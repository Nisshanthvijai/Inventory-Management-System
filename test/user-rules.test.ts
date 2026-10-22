import { ApiError } from '../src/domain/common/api-error';
import { adminActionForUserUpdate } from '../src/domain/users/user-rules';

const ME = 'user-me';
const OTHER = 'user-other';

describe('adminActionForUserUpdate', () => {
  it('lets anyone rename their own profile', () => {
    expect(adminActionForUserUpdate({ full_name: 'New Name' }, ME, ME)).toBeNull();
  });

  it("needs an admin to rename someone else's profile", () => {
    expect(adminActionForUserUpdate({ full_name: 'New Name' }, OTHER, ME)).toBe(
      "change another user's name",
    );
  });

  it.each([{ role: 'manager' }, { is_active: false }, { role: 'admin', full_name: 'X' }])(
    'needs an admin to change access on someone else: %o',
    (changes) => {
      expect(adminActionForUserUpdate(changes, OTHER, ME)).toBe('change a role or deactivate a user');
    },
  );

  it.each([{ role: 'admin' }, { is_active: false }, { is_active: true, full_name: 'X' }])(
    'refuses a change to your own access with a 403: %o',
    (changes) => {
      const run = () => adminActionForUserUpdate(changes, ME, ME);
      expect(run).toThrow('You cannot change your own role or active status');
      try {
        run();
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).getStatus()).toBe(403);
      }
    },
  );
});
