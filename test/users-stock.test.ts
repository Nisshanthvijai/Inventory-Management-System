import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';
import { makeFakeDb } from './fake-db';

const ME = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '11111111-1111-4111-8111-111111111111';
const STOCK = '22222222-2222-4222-8222-222222222222';
const fake = makeFakeDb();

describe('users and stock patch', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const auth = { Authorization: 'Bearer good-token' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(fake.supabase)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fake.reset('admin');
    // The caller's id is ME in these tests.
    fake.getUser.mockResolvedValue({ data: { user: { id: ME, email: 'me@x.com' } }, error: null });
  });

  describe('GET /api/users', () => {
    it('403 for a requestor', async () => {
      fake.reset('requestor');
      const res = await http().get('/api/users').set(auth);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only a manager or admin can list users');
    });

    it.each(['manager', 'admin'])('200 for a %s, ordered by name', async (role) => {
      fake.reset(role);
      fake.listResult.mockReturnValue({ data: [{ id: OTHER, full_name: 'Asha' }], error: null });
      const res = await http().get('/api/users').set(auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: OTHER, full_name: 'Asha' }]);
      expect(fake.order).toHaveBeenCalledWith('full_name');
    });
  });

  describe('PATCH /api/users/:id', () => {
    const patch = (id: string, body: object) => http().patch(`/api/users/${id}`).set(auth).send(body);

    it('anyone can rename themselves (no admin check)', async () => {
      fake.reset('requestor');
      fake.getUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
      const res = await patch(ME, { full_name: '  Nish ' });
      expect(res.status).toBe(200);
      expect(fake.update).toHaveBeenCalledWith({ full_name: 'Nish' });
      expect(fake.profileMaybe).not.toHaveBeenCalled();
    });

    it("403 when a non-admin renames someone else", async () => {
      fake.reset('manager');
      fake.getUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
      const res = await patch(OTHER, { full_name: 'X' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Only an admin can change another user's name");
      expect(fake.update).not.toHaveBeenCalled();
    });

    it.each([{ role: 'requestor' }, { is_active: false }])(
      '403 when changing your own role or status (%o), even as admin',
      async (body) => {
        const res = await patch(ME, body);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('You cannot change your own role or active status');
        expect(fake.update).not.toHaveBeenCalled();
      },
    );

    it('403 when a manager changes a role', async () => {
      fake.reset('manager');
      fake.getUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
      const res = await patch(OTHER, { role: 'admin' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only an admin can change a role or deactivate a user');
    });

    it('200 when an admin changes another user role', async () => {
      fake.updateMaybe.mockResolvedValue({ data: { id: OTHER, role: 'manager' }, error: null });
      const res = await patch(OTHER, { role: 'manager', is_active: true });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: OTHER, role: 'manager' });
      expect(fake.update).toHaveBeenCalledWith({ role: 'manager', is_active: true });
      expect(fake.updateEq).toHaveBeenCalledWith('id', OTHER);
    });

    it('404 when the user does not exist', async () => {
      fake.updateMaybe.mockResolvedValue({ data: null, error: null });
      expect((await patch(OTHER, { role: 'manager' })).status).toBe(404);
    });

    it('403 with the database message when the profile trigger refuses', async () => {
      fake.updateMaybe.mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'Only an admin can change a role or deactivate a user' },
      });
      expect((await patch(OTHER, { role: 'manager' })).status).toBe(403);
    });

    it.each([
      ['empty body', {}],
      ['unknown role', { role: 'owner' }],
      ['unknown field', { email: 'a@b.com' }],
      ['blank name', { full_name: ' ' }],
    ])('400 for %s', async (_n, body) => {
      expect((await patch(OTHER, body)).status).toBe(400);
      expect(fake.from).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/stock/:id', () => {
    const patch = (body: object, id = STOCK) =>
      http().patch(`/api/stock/${id}`).set(auth).send(body);

    it('200 sets the absolute quantity and returns the v_stock row', async () => {
      fake.readMaybe.mockResolvedValue({ data: { stock_id: STOCK, quantity: 120 }, error: null });
      const res = await patch({ quantity: 120 });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ stock_id: STOCK, quantity: 120 });
      expect(fake.update).toHaveBeenCalledWith({ quantity: 120 });
      expect(fake.updateEq).toHaveBeenCalledWith('id', STOCK);
      expect(fake.from).toHaveBeenCalledWith('v_stock');
      expect(fake.readEq).toHaveBeenCalledWith('stock_id', STOCK);
    });

    it('allows zero', async () => {
      expect((await patch({ quantity: 0 })).status).toBe(200);
    });

    it.each(['manager', 'requestor'])('403 for a %s, nothing updated', async (role) => {
      fake.reset(role);
      const res = await patch({ quantity: 5 });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only an admin can change stock');
      expect(fake.update).not.toHaveBeenCalled();
    });

    it.each([
      ['negative', { quantity: -1 }],
      ['missing', {}],
      ['a delta field', { adjust_by: 5 }],
      ['a string', { quantity: '5' }],
    ])('400 for %s quantity', async (_n, body) => {
      expect((await patch(body)).status).toBe(400);
      expect(fake.from).not.toHaveBeenCalled();
    });

    it('400 for a bad id', async () => {
      expect((await patch({ quantity: 1 }, 'abc')).status).toBe(400);
    });

    it('404 when no stock row has that id', async () => {
      fake.updateMaybe.mockResolvedValue({ data: null, error: null });
      const res = await patch({ quantity: 1 });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Stock row not found');
    });

    it('400 for a check-constraint failure, 500 otherwise', async () => {
      fake.updateMaybe.mockResolvedValue({ data: null, error: { code: '23514', message: 'check' } });
      expect((await patch({ quantity: 1 })).status).toBe(400);
      fake.updateMaybe.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
      expect((await patch({ quantity: 1 })).status).toBe(500);
    });
  });
});
