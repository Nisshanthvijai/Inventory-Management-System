import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const ID = '11111111-1111-4111-8111-111111111111';

const getUser = vi.fn();
const profileMaybe = vi.fn(); // profile: select().eq().maybeSingle()
const poMaybe = vi.fn(); // purchase_order read: select().eq().maybeSingle()
// purchase_order write: update(patch).eq('id').eq('status').select().maybeSingle()
const updateMaybe = vi.fn();
const updateEqStatus = vi.fn(() => ({ select: () => ({ maybeSingle: updateMaybe }) }));
const updateEqId = vi.fn(() => ({ eq: updateEqStatus }));
const update = vi.fn(() => ({ eq: updateEqId }));
// v_purchase_order read-back: select().eq().maybeSingle()
const viewMaybe = vi.fn();
const viewEq = vi.fn(() => ({ maybeSingle: viewMaybe }));

const from = vi.fn((table: string) => {
  switch (table) {
    case 'profile':
      return { select: () => ({ eq: () => ({ maybeSingle: profileMaybe }) }) };
    case 'purchase_order':
      return { select: () => ({ eq: () => ({ maybeSingle: poMaybe }) }), update };
    case 'v_purchase_order':
      return { select: () => ({ eq: viewEq }) };
    default:
      throw new Error(`unexpected table ${table}`);
  }
});
const forUser = vi.fn(() => ({ from }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const openPo = { id: ID, po_no: 'PO-2026-0003', status: 'open' };
const cancelledView = { po_id: ID, po_no: 'PO-2026-0003', status: 'cancelled', total_with_gst: 112 };

describe('POST /api/po/:id/cancel', () => {
  let app: INestApplication;

  const cancel = (id = ID) =>
    request(app.getHttpServer())
      .post(`/api/po/${id}/cancel`)
      .set('Authorization', 'Bearer good-token');

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
    for (const m of [getUser, profileMaybe, poMaybe, updateMaybe, viewMaybe]) m.mockReset();
    for (const m of [from, forUser, update, updateEqId, updateEqStatus, viewEq]) m.mockClear();
    // Happy path by default: a manager cancels an open PO.
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'm@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
    poMaybe.mockResolvedValue({ data: openPo, error: null });
    updateMaybe.mockResolvedValue({ data: { id: ID }, error: null });
    viewMaybe.mockResolvedValue({ data: cancelledView, error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).post(`/api/po/${ID}/cancel`);
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('400 when the id is not a UUID, and nothing is read', async () => {
    const res = await cancel('hello');
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe('Must be a valid UUID');
    expect(from).not.toHaveBeenCalled();
  });

  describe('role rule', () => {
    it('403 for a requestor; the PO is not read and not changed', async () => {
      profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
      const res = await cancel();
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only a manager or admin can cancel a PO');
      expect(from).not.toHaveBeenCalledWith('purchase_order');
      expect(update).not.toHaveBeenCalled();
    });

    it('403 when the caller has no profile', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: null });
      expect((await cancel()).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });

    it.each(['manager', 'admin'])('allows a %s', async (role) => {
      profileMaybe.mockResolvedValue({ data: { role }, error: null });
      expect((await cancel()).status).toBe(200);
    });
  });

  it('404 when the PO does not exist, and nothing is changed', async () => {
    poMaybe.mockResolvedValue({ data: null, error: null });
    const res = await cancel();
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('PO not found');
    expect(update).not.toHaveBeenCalled();
  });

  describe('only an open PO can be cancelled', () => {
    it.each(['partially_received', 'received', 'cancelled'])(
      '409 when the PO is %s, and nothing is changed',
      async (status) => {
        poMaybe.mockResolvedValue({ data: { ...openPo, status }, error: null });
        const res = await cancel();
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          `PO PO-2026-0003 is ${status}; only an open PO can be cancelled`,
        );
        expect(update).not.toHaveBeenCalled();
      },
    );
  });

  describe('the cancel', () => {
    it('200 returns the PO from v_purchase_order with status cancelled', async () => {
      const res = await cancel();
      expect(res.status).toBe(200);
      expect(res.body).toEqual(cancelledView);
      expect(viewEq).toHaveBeenCalledWith('po_id', ID);
    });

    it('sets only the status, and only on an open PO, using the caller JWT', async () => {
      await cancel();
      expect(forUser).toHaveBeenCalledWith('good-token');
      expect(update).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(updateEqId).toHaveBeenCalledWith('id', ID);
      expect(updateEqStatus).toHaveBeenCalledWith('status', 'open');
    });

    it('409 when the PO changed between the read and the update (no row updated)', async () => {
      updateMaybe.mockResolvedValue({ data: null, error: null });
      const res = await cancel();
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('The PO changed while cancelling; reload it and try again');
    });
  });

  describe('database errors become clear ApiErrors', () => {
    it.each([
      [
        'P0001',
        'This PO already has goods received and cannot be cancelled',
        409,
        'This PO already has goods received and cannot be cancelled',
      ],
      [
        'P0001',
        'PO status is updated automatically (only an open PO can be cancelled)',
        409,
        'PO status is updated automatically (only an open PO can be cancelled)',
      ],
      ['42501', 'row-level security', 403, 'You cannot cancel this PO'],
      ['XX000', 'internal', 500, 'Something went wrong'],
    ])('%s "%s" -> %i', async (code, dbMessage, status, message) => {
      updateMaybe.mockResolvedValue({ data: null, error: { code, message: dbMessage } });
      const res = await cancel();
      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
    });
  });

  describe('500 when a read fails', () => {
    it('profile', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: { message: 'profile boom' } });
      const res = await cancel();
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Something went wrong');
    });

    it('PO', async () => {
      poMaybe.mockResolvedValue({ data: null, error: { message: 'po boom' } });
      const res = await cancel();
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Something went wrong');
      expect(update).not.toHaveBeenCalled();
    });

    it('result read-back', async () => {
      viewMaybe.mockResolvedValue({ data: null, error: { message: 'view boom' } });
      const res = await cancel();
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Something went wrong');
    });
  });
});
