import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const PO = '11111111-1111-4111-8111-111111111111';
const POL1 = '22222222-2222-4222-8222-222222222222';
const POL2 = '33333333-3333-4333-8333-333333333333';
const VAR1 = '44444444-4444-4444-8444-444444444444';
const VAR2 = '55555555-5555-4555-8555-555555555555';

const getUser = vi.fn();
const profileMaybe = vi.fn(); // profile: select().eq().maybeSingle()
const rpc = vi.fn();
const order = vi.fn(); // goods_receipt: select(cols).order()
const receiptSelect = vi.fn(() => ({ order }));

const from = vi.fn((table: string) => {
  if (table === 'profile') {
    return { select: () => ({ eq: () => ({ maybeSingle: profileMaybe }) }) };
  }
  if (table === 'goods_receipt') return { select: receiptSelect };
  throw new Error(`unexpected table ${table}`);
});
const forUser = vi.fn(() => ({ from, rpc }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const line = (extra: object = {}) => ({
  po_line_id: POL1,
  variant_id: VAR1,
  received_quantity: 2,
  ...extra,
});
const grn = (lines: object[], extra: object = {}) => ({
  po_id: PO,
  invoice_no: 'INV-100',
  lines,
  ...extra,
});

describe('GRN', () => {
  let app: INestApplication;

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/grn')
      .set('Authorization', 'Bearer good-token')
      .send(body as object);
  const get = () =>
    request(app.getHttpServer()).get('/api/grn').set('Authorization', 'Bearer good-token');

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
    for (const m of [getUser, profileMaybe, rpc, order]) m.mockReset();
    for (const m of [from, forUser, receiptSelect]) m.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'r@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
    rpc.mockResolvedValue({ data: { grn_id: 'g1', grn_no: 'GRN-2026-0001', lines: 1 }, error: null });
    order.mockResolvedValue({ data: [], error: null });
  });

  describe('POST /api/grn', () => {
    it('401 without a token', async () => {
      const res = await request(app.getHttpServer()).post('/api/grn').send(grn([line()]));
      expect(res.status).toBe(401);
      expect(from).not.toHaveBeenCalled();
    });

    describe('400 for a bad body, before any database call', () => {
      it.each([
        ['no po_id', { invoice_no: 'A', lines: [line()] }],
        ['po_id not a uuid', grn([line()], { po_id: 'abc' })],
        ['no invoice number', { po_id: PO, lines: [line()] }],
        ['blank invoice number', grn([line()], { invoice_no: '   ' })],
        ['no lines', grn([])],
        ['quantity 0', grn([line({ received_quantity: 0 })])],
        ['negative quantity', grn([line({ received_quantity: -1 })])],
        ['no variant_id on a line', grn([{ po_line_id: POL1, received_quantity: 1 }])],
        ['po_line_id not a uuid', grn([line({ po_line_id: 'x' })])],
        ['completes_line not a boolean', grn([line({ completes_line: 'yes' })])],
        ['bad invoice date', grn([line()], { invoice_date: '12/31/2026' })],
        ['bad received date', grn([line()], { received_date: 'today' })],
        ['an unknown field', grn([line()], { received_by: 'someone-else' })],
        ['the same PO line twice', grn([line(), line()])],
      ])('%s', async (_name, body) => {
        const res = await post(body);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(from).not.toHaveBeenCalled();
      });
    });

    describe('role rule', () => {
      it('403 for a manager, and no GRN is created', async () => {
        profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
        const res = await post(grn([line()]));
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('A manager cannot receive goods; a requestor or admin can');
        expect(rpc).not.toHaveBeenCalled();
      });

      it('403 when the caller has no profile', async () => {
        profileMaybe.mockResolvedValue({ data: null, error: null });
        const res = await post(grn([line()]));
        expect(res.status).toBe(403);
        expect(rpc).not.toHaveBeenCalled();
      });

      it.each(['requestor', 'admin'])('allows a %s', async (role) => {
        profileMaybe.mockResolvedValue({ data: { role }, error: null });
        expect((await post(grn([line()]))).status).toBe(201);
      });

      it('500 when the profile read fails', async () => {
        profileMaybe.mockResolvedValue({ data: null, error: { message: 'profile boom' } });
        const res = await post(grn([line()]));
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('profile boom');
      });
    });

    describe('the create_grn call', () => {
      it('201 with the GRN number, sending lines (completes_line defaulted) and null extras', async () => {
        const res = await post(grn([line()]));
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ grn_id: 'g1', grn_no: 'GRN-2026-0001', lines: 1 });
        expect(forUser).toHaveBeenCalledWith('good-token');
        expect(rpc).toHaveBeenCalledWith('create_grn', {
          p_po_id: PO,
          p_invoice_no: 'INV-100',
          p_lines: [{ po_line_id: POL1, variant_id: VAR1, received_quantity: 2, completes_line: false }],
          p_invoice_date: null,
          p_received_date: null,
          p_comments: null,
        });
      });

      it('passes dates, comments, completes_line and a substitute variant through', async () => {
        await post(
          grn(
            [
              line({ completes_line: true }),
              { po_line_id: POL2, variant_id: VAR2, received_quantity: 1.5 },
            ],
            {
              invoice_no: '  INV-7 ',
              invoice_date: '2026-10-10',
              received_date: '2026-10-17',
              comments: 'boxes damaged',
            },
          ),
        );
        expect(rpc).toHaveBeenCalledWith('create_grn', {
          p_po_id: PO,
          p_invoice_no: 'INV-7',
          p_lines: [
            { po_line_id: POL1, variant_id: VAR1, received_quantity: 2, completes_line: true },
            { po_line_id: POL2, variant_id: VAR2, received_quantity: 1.5, completes_line: false },
          ],
          p_invoice_date: '2026-10-10',
          p_received_date: '2026-10-17',
          p_comments: 'boxes damaged',
        });
      });
    });

    describe('database errors become clear ApiErrors', () => {
      const exceed = 'Receiving 5 would exceed the ordered quantity 3 (already received: 0)';
      it.each([
        ['P0001', 'This PO line is already complete', 409, 'This PO line is already complete'],
        ['P0001', exceed, 400, exceed],
        ['P0001', 'A GRN needs at least one line', 400, 'A GRN needs at least one line'],
        ['23514', 'violates check constraint "grn_invoice_not_blank"', 400, 'violates check constraint "grn_invoice_not_blank"'],
        [
          '42501',
          'row-level security',
          403,
          'You cannot receive goods on this PO: it must be open or partially received (not fully received or cancelled), and a requestor needs one of their own lines on it',
        ],
        [
          '23503',
          'fk violation',
          400,
          'The PO or a PO line does not exist, or a line does not belong to this PO',
        ],
        ['23505', 'duplicate key', 409, 'This PO line is already on this GRN'],
        ['XX000', 'internal', 500, 'internal'],
      ])('%s "%s" -> %i', async (code, dbMessage, status, message) => {
        rpc.mockResolvedValue({ data: null, error: { code, message: dbMessage } });
        const res = await post(grn([line()]));
        expect(res.status).toBe(status);
        expect(res.body.message).toBe(message);
      });
    });
  });

  describe('GET /api/grn', () => {
    const receipt = {
      id: 'g1',
      grn_no: 'GRN-2026-0001',
      po_id: PO,
      received_date: '2026-10-17',
      invoice_no: 'INV-100',
      received_by: 'u1',
      lines: [{ id: 'l1', po_line_id: POL1, variant_id: VAR1, received_quantity: 2, completes_line: false }],
    };

    it('401 without a token', async () => {
      const res = await request(app.getHttpServer()).get('/api/grn');
      expect(res.status).toBe(401);
      expect(from).not.toHaveBeenCalled();
    });

    it.each(['requestor', 'manager', 'admin'])('200 for a %s: no role check, RLS decides', async (role) => {
      profileMaybe.mockResolvedValue({ data: { role }, error: null });
      order.mockResolvedValue({ data: [{ ...receipt, receiver: { full_name: 'Asha' } }], error: null });
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ ...receipt, received_by_name: 'Asha' }]);
      expect(from).not.toHaveBeenCalledWith('profile');
    });

    it('reads goods_receipt (not v_grn_lines), newest first, with the caller JWT', async () => {
      await get();
      expect(forUser).toHaveBeenCalledWith('good-token');
      expect(from).toHaveBeenCalledWith('goods_receipt');
      expect(from).not.toHaveBeenCalledWith('v_grn_lines');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
      const columns = (receiptSelect.mock.calls[0] as unknown as [string])[0];
      expect(columns).toContain('lines:grn_line(');
    });

    it('accepts the receiver as a list, and a hidden profile as null', async () => {
      order.mockResolvedValue({
        data: [
          { ...receipt, id: 'g1', receiver: [{ full_name: 'Ravi' }] },
          { ...receipt, id: 'g2', receiver: null },
        ],
        error: null,
      });
      const res = await get();
      expect(res.body.map((r: { received_by_name: string | null }) => r.received_by_name)).toEqual(['Ravi', null]);
      expect(res.body[0]).not.toHaveProperty('receiver');
    });

    it('200 with an empty list when there are none', async () => {
      order.mockResolvedValue({ data: null, error: null });
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('500 with the standard shape when the read fails', async () => {
      order.mockResolvedValue({ data: null, error: { message: 'grn boom' } });
      const res = await get();
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('grn boom');
    });
  });
});
