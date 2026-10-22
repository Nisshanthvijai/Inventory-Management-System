import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const ID = '11111111-1111-4111-8111-111111111111';

const getUser = vi.fn();

// profile: select().eq().maybeSingle()
const profileMaybe = vi.fn();
// pr_line read: select().eq().maybeSingle()
const lineMaybe = vi.fn();
// pr_line write: update(patch).eq().select().maybeSingle()
const updateMaybe = vi.fn();
const update = vi.fn(() => ({ eq: () => ({ select: () => ({ maybeSingle: updateMaybe }) }) }));
// v_pr_lines read: select().eq().maybeSingle()
const viewMaybe = vi.fn();
const viewEq = vi.fn(() => ({ maybeSingle: viewMaybe }));

const reader = (maybeSingle: typeof lineMaybe) => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
});

const from = vi.fn((table: string) => {
  if (table === 'profile') return reader(profileMaybe);
  if (table === 'pr_line') return { ...reader(lineMaybe), update };
  if (table === 'v_pr_lines') return { select: () => ({ eq: viewEq }) };
  throw new Error(`unexpected table ${table}`);
});
const forUser = vi.fn(() => ({ from }));

const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const viewRow = { pr_line_id: ID, line_status: 'accepted', pr_status: 'reviewed' };

describe('PATCH /api/pr-lines/:id', () => {
  let app: INestApplication;

  const patch = (body: unknown, id = ID) =>
    request(app.getHttpServer())
      .patch(`/api/pr-lines/${id}`)
      .set('Authorization', 'Bearer good-token')
      .send(body as object);

  const accept = (approved_quantity: number) => patch({ status: 'accepted', approved_quantity });
  const reject = (rejection_comment: string) => patch({ status: 'rejected', rejection_comment });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(fakeSupabase)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const m of [getUser, profileMaybe, lineMaybe, updateMaybe, viewMaybe]) m.mockReset();
    for (const m of [from, forUser, update, viewEq]) m.mockClear();
    // Happy path by default: a manager decides on a line that asked for 5.
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'm@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
    lineMaybe.mockResolvedValue({ data: { id: ID, quantity: 5 }, error: null });
    updateMaybe.mockResolvedValue({ data: { id: ID }, error: null });
    viewMaybe.mockResolvedValue({ data: viewRow, error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/pr-lines/${ID}`)
      .send({ status: 'rejected', rejection_comment: 'no' });
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('400 when the id is not a UUID, and nothing is read', async () => {
    const res = await patch({ status: 'rejected', rejection_comment: 'no' }, 'hello');
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe('Must be a valid UUID');
    expect(from).not.toHaveBeenCalled();
  });

  describe('400 for a bad body, before any database call', () => {
    it.each([
      ['empty body', {}],
      ['status pending (undo is not allowed)', { status: 'pending' }],
      ['unknown status', { status: 'approved' }],
      ['accepted without a quantity', { status: 'accepted' }],
      ['accepted with quantity 0', { status: 'accepted', approved_quantity: 0 }],
      ['accepted with a negative quantity', { status: 'accepted', approved_quantity: -1 }],
      ['accepted with a comment', { status: 'accepted', approved_quantity: 1, rejection_comment: 'x' }],
      ['rejected without a comment', { status: 'rejected' }],
      ['rejected with a blank comment', { status: 'rejected', rejection_comment: '   ' }],
      ['rejected with a quantity', { status: 'rejected', rejection_comment: 'no', approved_quantity: 2 }],
    ])('%s', async (_name, body) => {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('role rule', () => {
    it('403 for a requestor, and nothing else is read or written', async () => {
      profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
      const res = await accept(2);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only a manager or admin can decide on a PR line');
      expect(lineMaybe).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('403 when the caller has no profile', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: null });
      const res = await accept(2);
      expect(res.status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });

    it.each(['manager', 'admin'])('allows a %s', async (role) => {
      profileMaybe.mockResolvedValue({ data: { role }, error: null });
      const res = await accept(2);
      expect(res.status).toBe(200);
    });

    it('500 when the profile read fails', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: { message: 'profile boom' } });
      const res = await accept(2);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('profile boom');
    });
  });

  describe('line must exist', () => {
    it('404 when the line is missing or hidden, and nothing is updated', async () => {
      lineMaybe.mockResolvedValue({ data: null, error: null });
      const res = await accept(2);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('PR line not found');
      expect(update).not.toHaveBeenCalled();
    });

    it('500 when the line read fails', async () => {
      lineMaybe.mockResolvedValue({ data: null, error: { message: 'line boom' } });
      const res = await accept(2);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('line boom');
    });
  });

  describe('approved quantity limit', () => {
    it('400 when approved is above requested, naming the limit; no update', async () => {
      const res = await accept(6);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Approved quantity cannot exceed the requested quantity (5)');
      expect(update).not.toHaveBeenCalled();
    });

    it('allows approving exactly the requested quantity', async () => {
      const res = await accept(5);
      expect(res.status).toBe(200);
    });

    it('allows a partial approval', async () => {
      const res = await accept(1.5);
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith({
        status: 'accepted',
        approved_quantity: 1.5,
        rejection_comment: null,
      });
    });

    it('reads a numeric quantity that arrives as a string', async () => {
      lineMaybe.mockResolvedValue({ data: { id: ID, quantity: '5.0' }, error: null });
      expect((await accept(5)).status).toBe(200);
      expect((await accept(5.5)).status).toBe(400);
    });

    it('a rejection is not limited by quantity', async () => {
      const res = await reject('Out of budget');
      expect(res.status).toBe(200);
    });
  });

  describe('the update', () => {
    it('accepting sets the quantity and clears the comment', async () => {
      const res = await accept(3);
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith({
        status: 'accepted',
        approved_quantity: 3,
        rejection_comment: null,
      });
      expect(forUser).toHaveBeenCalledWith('good-token');
    });

    it('rejecting sets the (trimmed) comment and clears the quantity', async () => {
      const res = await reject('  Out of budget  ');
      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith({
        status: 'rejected',
        approved_quantity: null,
        rejection_comment: 'Out of budget',
      });
    });

    it('returns the line from v_pr_lines, with the recalculated PR status', async () => {
      const res = await accept(3);
      expect(res.body).toEqual(viewRow);
      expect(from).toHaveBeenCalledWith('v_pr_lines');
      expect(viewEq).toHaveBeenCalledWith('pr_line_id', ID);
    });

    it('500 when reading the result back fails', async () => {
      viewMaybe.mockResolvedValue({ data: null, error: { message: 'view boom' } });
      const res = await accept(3);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('view boom');
    });
  });

  describe('database errors become clear ApiErrors', () => {
    it.each([
      ['P0001', 'This line is already on a PO and can no longer be changed', 409],
      ['P0001', 'A manager decides on a line; the requested quantity and item cannot be changed', 400],
      ['23514', 'violates check constraint "pr_line_accepted_needs_qty"', 400],
      ['42501', 'row-level security', 403],
      ['XX000', 'internal', 500],
    ])('%s "%s" -> %i', async (code, message, status) => {
      updateMaybe.mockResolvedValue({ data: null, error: { code, message } });
      const res = await accept(2);
      expect(res.status).toBe(status);
    });

    it('409 keeps a clear message for the PO lock', async () => {
      updateMaybe.mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'This line is already on a PO and can no longer be changed' },
      });
      const res = await accept(2);
      expect(res.body.message).toBe('This line is already on a PO and can no longer be changed');
    });

    it('403 when the update touches no row (RLS)', async () => {
      updateMaybe.mockResolvedValue({ data: null, error: null });
      const res = await accept(2);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You cannot decide on this line');
    });
  });
});
