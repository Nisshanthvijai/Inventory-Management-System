import { SupabaseClient } from '@supabase/supabase-js';
import { UnexpectedError } from '../src/application/common/errors';
import { PermissionService } from '../src/application/common/permission.service';
import { RoleReader } from '../src/application/common/role-reader';
import { NotAllowed } from '../src/domain/common/errors';
import { Role } from '../src/domain/common/role';
import { SupabaseRoleReader } from '../src/infrastructure/supabase/supabase-role.reader';

const db = {} as SupabaseClient;
const user = { id: 'u1', email: 'x@x.com' };

describe('PermissionService (with a fake RoleReader: no Nest, no database)', () => {
  const service = (role: Role | null) => {
    const roleOf = vi.fn(async () => role);
    return { permissions: new PermissionService({ roleOf } as RoleReader), roleOf };
  };

  it('reads the role of the caller, with the caller db', async () => {
    const { permissions, roleOf } = service('manager');
    await permissions.require(db, user, 'po.create');
    expect(roleOf).toHaveBeenCalledWith(db, 'u1');
  });

  it('lets an allowed role through', async () => {
    await expect(service('admin').permissions.require(db, user, 'stock.set')).resolves.toBeUndefined();
  });

  it('refuses with the permission table message', async () => {
    const { permissions } = service('requestor');
    await expect(permissions.require(db, user, 'po.create')).rejects.toThrow(NotAllowed);
    await expect(permissions.require(db, user, 'po.create')).rejects.toThrow(
      'Only a manager or admin can create a PO',
    );
  });

  it('passes the subject through', async () => {
    await expect(service('manager').permissions.require(db, user, 'master.write', 'brand')).rejects.toThrow(
      'Only an admin can create or change brands',
    );
  });

  it('refuses a caller with no profile row', async () => {
    await expect(service(null).permissions.require(db, user, 'user.list')).rejects.toThrow(NotAllowed);
  });
});

describe('SupabaseRoleReader', () => {
  const fakeDb = (result: { data: unknown; error: unknown }) => {
    const eq = vi.fn(() => ({ maybeSingle: async () => result }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { db: { from } as unknown as SupabaseClient, from, select, eq };
  };

  it('reads profile.role for the user id', async () => {
    const f = fakeDb({ data: { role: 'manager' }, error: null });
    await expect(new SupabaseRoleReader().roleOf(f.db, 'u1')).resolves.toBe('manager');
    expect(f.from).toHaveBeenCalledWith('profile');
    expect(f.select).toHaveBeenCalledWith('role');
    expect(f.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('returns null when there is no profile row', async () => {
    await expect(new SupabaseRoleReader().roleOf(fakeDb({ data: null, error: null }).db, 'u1')).resolves.toBeNull();
  });

  it('returns null for a role the app does not know', async () => {
    const f = fakeDb({ data: { role: 'superuser' }, error: null });
    await expect(new SupabaseRoleReader().roleOf(f.db, 'u1')).resolves.toBeNull();
  });

  it('throws UnexpectedError with the database message when the read fails', async () => {
    const f = fakeDb({ data: null, error: { message: 'boom' } });
    await expect(new SupabaseRoleReader().roleOf(f.db, 'u1')).rejects.toThrow(UnexpectedError);
    await expect(new SupabaseRoleReader().roleOf(f.db, 'u1')).rejects.toThrow('boom');
  });
});
