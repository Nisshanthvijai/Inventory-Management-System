import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const PRL1 = '11111111-1111-4111-8111-111111111111';
const PRL2 = '22222222-2222-4222-8222-222222222222';
const VENDOR = '33333333-3333-4333-8333-333333333333';
const VAR1 = '44444444-4444-4444-8444-444444444444';
const VAR2 = '55555555-5555-4555-8555-555555555555';

const getUser = vi.fn();
const profileMaybe = vi.fn(); // profile: select().eq().maybeSingle()
const prLinesIn = vi.fn(); // pr_line: select().in()
const variantsIn = vi.fn(); // v_variants: select().in()
const orderedNeq = vi.fn(); // v_po_lines: select().in().neq()
const orderedIn = vi.fn(() => ({ neq: orderedNeq }));
const rpc = vi.fn();

const from = vi.fn((table: string) => {
  switch (table) {
    case 'profile':
      return { select: () => ({ eq: () => ({ maybeSingle: profileMaybe }) }) };
    case 'pr_line':
      return { select: () => ({ in: prLinesIn }) };
    case 'v_variants':
      return { select: () => ({ in: variantsIn }) };
    case 'v_po_lines':
      return { select: () => ({ in: orderedIn }) };
    default:
      throw new Error(`unexpected table ${table}`);
  }
});
const forUser = vi.fn(() => ({ from, rpc }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

// A strip holds 10 tablets. 25 tablets approved -> rounded up to 3 strips.
const packVariant = {
  variant_id: VAR1,
  code: 'PARA-CIP-TAB',
  stock_unit: 'tablet',
  purchase_unit: 'strip',
  units_per_purchase: 10,
};
const acceptedLine = { id: PRL1, status: 'accepted', approved_quantity: 25, variant_id: VAR1 };

const line = (quantity: number, extra: object = {}) => ({
  pr_line_id: PRL1,
  price: 5,
  quantity,
  ...extra,
});
const po = (lines: object[], extra: object = {}) => ({ vendor_id: VENDOR, lines, ...extra });

describe('POST /api/po', () => {
  let app: INestApplication;

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/po')
      .set('Authorization', 'Bearer good-token')
      .send(body as object);

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
    for (const m of [getUser, profileMaybe, prLinesIn, variantsIn, orderedNeq, rpc]) m.mockReset();
    for (const m of [from, forUser, orderedIn]) m.mockClear();
    // Happy path by default: a manager orders 25 tablets' worth from a PR line, nothing ordered yet.
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'm@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
    prLinesIn.mockResolvedValue({ data: [acceptedLine], error: null });
    variantsIn.mockResolvedValue({ data: [packVariant], error: null });
    orderedNeq.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: { po_id: 'po1', po_no: 'PO-2026-0001', lines: 1 }, error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).post('/api/po').send(po([line(1)]));
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  describe('400 for a bad body, before any database call', () => {
    it.each([
      ['no vendor', { lines: [line(1)] }],
      ['vendor is not a uuid', po([line(1)], { vendor_id: 'abc' })],
      ['lines missing', { vendor_id: VENDOR }],
      ['empty lines', po([])],
      ['negative price', po([line(1, { price: -1 })])],
      ['quantity 0', po([line(0)])],
      ['gst above 100', po([line(1, { gst: 101 })])],
      ['bad arrival date', po([line(1, { arrival_date: '31-12-2026' })])],
      ['bad po date', po([line(1)], { po_date: 'tomorrow' })],
      ['a substitute variant_id on a line', po([line(1, { variant_id: VAR2 })])],
      ['an unknown top-level field', po([line(1)], { status: 'cancelled' })],
      ['the same PR line twice', po([line(1), line(2)])],
      ['blank payment terms', po([line(1)], { payment_terms: '   ' })],
    ])('%s', async (_name, body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('role rule', () => {
    it('403 for a requestor; nothing else is read and no PO is created', async () => {
      profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Only a manager or admin can create a PO');
      expect(prLinesIn).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('403 when the caller has no profile', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: null });
      expect((await post(po([line(1)]))).status).toBe(403);
      expect(rpc).not.toHaveBeenCalled();
    });

    it.each(['manager', 'admin'])('allows a %s', async (role) => {
      profileMaybe.mockResolvedValue({ data: { role }, error: null });
      expect((await post(po([line(1)]))).status).toBe(201);
    });
  });

  describe('the PR lines must be orderable', () => {
    it('404 when a PR line is missing or hidden', async () => {
      prLinesIn.mockResolvedValue({ data: [], error: null });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(`PR line not found: ${PRL1}`);
      expect(rpc).not.toHaveBeenCalled();
    });

    it.each(['pending', 'rejected'])('400 when the PR line is %s', async (status) => {
      prLinesIn.mockResolvedValue({ data: [{ ...acceptedLine, status }], error: null });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        `PARA-CIP-TAB: only an accepted PR line can be ordered (this one is ${status})`,
      );
      expect(rpc).not.toHaveBeenCalled();
    });

    it('reads the PR lines and the already-ordered rows once, for all lines, ignoring cancelled POs', async () => {
      await post(po([line(1)]));
      expect(prLinesIn).toHaveBeenCalledWith('id', [PRL1]);
      expect(variantsIn).toHaveBeenCalledWith('variant_id', [VAR1]);
      expect(orderedIn).toHaveBeenCalledWith('pr_line_id', [PRL1]);
      expect(orderedNeq).toHaveBeenCalledWith('po_status', 'cancelled');
    });
  });

  describe('whole packs', () => {
    it('400 for a fractional quantity when a pack holds more than 1 unit', async () => {
      const res = await post(po([line(1.5)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'PARA-CIP-TAB: quantity must be a whole number of strip (1 strip = 10 tablet); got 1.5',
      );
      expect(rpc).not.toHaveBeenCalled();
    });

    it('allows a fractional quantity when units_per_purchase is 1', async () => {
      prLinesIn.mockResolvedValue({
        data: [{ ...acceptedLine, approved_quantity: 2.5 }],
        error: null,
      });
      variantsIn.mockResolvedValue({
        data: [{ ...packVariant, units_per_purchase: 1 }],
        error: null,
      });
      expect((await post(po([line(1.5)]))).status).toBe(201);
    });
  });

  describe('pack rounding (approved 25 tablets, 10 per strip -> 3 strips)', () => {
    it.each([1, 2, 3])('allows %i strips', async (q) => {
      expect((await post(po([line(q)]))).status).toBe(201);
    });

    it('400 for 4 strips, and the message explains the rounding', async () => {
      const res = await post(po([line(4)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'PARA-CIP-TAB: you can order at most 3 strip more ' +
          '(approved 25 tablet = 3 strip rounded up to whole packs, 0 already ordered); got 4',
      );
      expect(rpc).not.toHaveBeenCalled();
    });

    it('subtracts what is already ordered on other POs', async () => {
      orderedNeq.mockResolvedValue({
        data: [{ pr_line_id: PRL1, ordered_stock_units: '10' }], // 1 strip
        error: null,
      });
      expect((await post(po([line(2)]))).status).toBe(201);
      const res = await post(po([line(3)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 2 strip more');
      expect(res.body.message).toContain('1 already ordered');
    });

    it('adds up several earlier PO lines for the same PR line', async () => {
      orderedNeq.mockResolvedValue({
        data: [
          { pr_line_id: PRL1, ordered_stock_units: 10 },
          { pr_line_id: PRL1, ordered_stock_units: '10' },
        ],
        error: null,
      });
      expect((await post(po([line(1)]))).status).toBe(201);
      const res = await post(po([line(2)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 1 strip more');
    });

    it('400 with "at most 0" when the line is fully ordered', async () => {
      orderedNeq.mockResolvedValue({
        data: [{ pr_line_id: PRL1, ordered_stock_units: 30 }],
        error: null,
      });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at most 0 strip more');
    });

    it('an exact multiple is not rounded further (30 approved -> 3 strips)', async () => {
      prLinesIn.mockResolvedValue({
        data: [{ ...acceptedLine, approved_quantity: 30 }],
        error: null,
      });
      expect((await post(po([line(3)]))).status).toBe(201);
      expect((await post(po([line(4)]))).status).toBe(400);
    });

    it('no rounding when units_per_purchase is 1: approved is the limit', async () => {
      prLinesIn.mockResolvedValue({
        data: [{ ...acceptedLine, approved_quantity: 7 }],
        error: null,
      });
      variantsIn.mockResolvedValue({
        data: [{ ...packVariant, units_per_purchase: 1 }],
        error: null,
      });
      expect((await post(po([line(7)]))).status).toBe(201);
      expect((await post(po([line(8)]))).status).toBe(400);
    });

    it('units_per_purchase below 1: the limit is approved / units', async () => {
      // 10 stock units, each purchase unit is 0.5 stock units -> up to 20 purchase units.
      prLinesIn.mockResolvedValue({
        data: [{ ...acceptedLine, approved_quantity: 10 }],
        error: null,
      });
      variantsIn.mockResolvedValue({
        data: [{ ...packVariant, units_per_purchase: 0.5 }],
        error: null,
      });
      expect((await post(po([line(20)]))).status).toBe(201);
      expect((await post(po([line(21)]))).status).toBe(400);
    });

    it('reads numeric values that arrive as strings', async () => {
      prLinesIn.mockResolvedValue({
        data: [{ ...acceptedLine, approved_quantity: '25.0000' }],
        error: null,
      });
      variantsIn.mockResolvedValue({
        data: [{ ...packVariant, units_per_purchase: '10' }],
        error: null,
      });
      expect((await post(po([line(3)]))).status).toBe(201);
      expect((await post(po([line(4)]))).status).toBe(400);
    });

    it('checks every line and names the one that fails', async () => {
      prLinesIn.mockResolvedValue({
        data: [acceptedLine, { id: PRL2, status: 'accepted', approved_quantity: 3, variant_id: VAR2 }],
        error: null,
      });
      variantsIn.mockResolvedValue({
        data: [
          packVariant,
          { variant_id: VAR2, code: 'GLV-ANS-NIT', stock_unit: 'box', purchase_unit: 'box', units_per_purchase: 1 },
        ],
        error: null,
      });
      const ok = await post(po([line(3), { pr_line_id: PRL2, price: 9, quantity: 3 }]));
      expect(ok.status).toBe(201);
      const bad = await post(po([line(3), { pr_line_id: PRL2, price: 9, quantity: 4 }]));
      expect(bad.status).toBe(400);
      expect(bad.body.message).toContain('GLV-ANS-NIT');
    });
  });

  describe('the create_po call', () => {
    it('201 with the PO number, sending lines (gst defaulted) and null extras', async () => {
      const res = await post(po([line(2)]));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ po_id: 'po1', po_no: 'PO-2026-0001', lines: 1 });
      expect(forUser).toHaveBeenCalledWith('good-token');
      expect(rpc).toHaveBeenCalledWith('create_po', {
        p_vendor_id: VENDOR,
        p_lines: [{ pr_line_id: PRL1, price: 5, quantity: 2, gst: 0 }],
        p_payment_terms: null,
        p_comments: null,
        p_po_date: null,
      });
    });

    it('passes terms, comments, date, gst and arrival date through', async () => {
      await post(
        po([line(2, { gst: 12, arrival_date: '2026-11-01' })], {
          payment_terms: '  30 days ',
          comments: 'urgent',
          po_date: '2026-10-17',
        }),
      );
      expect(rpc).toHaveBeenCalledWith('create_po', {
        p_vendor_id: VENDOR,
        p_lines: [{ pr_line_id: PRL1, price: 5, quantity: 2, gst: 12, arrival_date: '2026-11-01' }],
        p_payment_terms: '30 days',
        p_comments: 'urgent',
        p_po_date: '2026-10-17',
      });
    });
  });

  describe('database errors become clear ApiErrors', () => {
    it.each([
      ['P0001', 'Vendor not found', 404, 'Vendor not found'],
      ['P0001', 'This vendor is not active', 400, 'This vendor is not active'],
      ['P0001', 'One or more PR lines were not found or are not visible to you', 400, 'One or more PR lines were not found or are not visible to you'],
      ['23505', 'duplicate key', 409, 'This PR line is already on this PO'],
      ['23503', 'fk violation', 400, 'A referenced record does not exist'],
      ['42501', 'row-level security', 403, 'You cannot create a PO'],
      ['XX000', 'internal', 500, 'Something went wrong'],
    ])('%s "%s" -> %i', async (code, dbMessage, status, message) => {
      rpc.mockResolvedValue({ data: null, error: { code, message: dbMessage } });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
    });
  });

  describe('500 when a read fails', () => {
    it('PR lines', async () => {
      prLinesIn.mockResolvedValue({ data: null, error: { message: 'pr boom' } });
      const res = await post(po([line(1)]));
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Something went wrong');
    });

    it('variants', async () => {
      variantsIn.mockResolvedValue({ data: null, error: { message: 'variant boom' } });
      expect((await post(po([line(1)]))).body.message).toBe('Something went wrong');
    });

    it('already-ordered rows', async () => {
      orderedNeq.mockResolvedValue({ data: null, error: { message: 'ordered boom' } });
      expect((await post(po([line(1)]))).body.message).toBe('Something went wrong');
    });
  });
});
