import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const ID = '11111111-1111-4111-8111-111111111111';

const getUser = vi.fn();
const profileMaybe = vi.fn(); // profile: select().eq().maybeSingle()

// header: from('v_purchase_order').select().eq().maybeSingle()
const headerMaybe = vi.fn();
const headerEq = vi.fn(() => ({ maybeSingle: headerMaybe }));

// lines: from('v_po_lines').select().eq().order().order()
const secondOrder = vi.fn();
const firstOrder = vi.fn(() => ({ order: secondOrder }));
const linesEq = vi.fn(() => ({ order: firstOrder }));

const from = vi.fn((table: string) => {
  switch (table) {
    case 'profile':
      return { select: () => ({ eq: () => ({ maybeSingle: profileMaybe }) }) };
    case 'v_purchase_order':
      return { select: () => ({ eq: headerEq }) };
    case 'v_po_lines':
      return { select: () => ({ eq: linesEq }) };
    default:
      throw new Error(`unexpected table ${table}`);
  }
});
const forUser = vi.fn(() => ({ from }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const header = {
  po_id: ID,
  po_no: 'PO-2026-0001',
  status: 'open',
  vendor_name: 'LabWorld Traders',
  line_count: 1,
  total_before_gst: 100,
  total_with_gst: 112,
};
const line = {
  po_line_id: 'l1',
  po_id: ID,
  item_name: 'Examination Gloves',
  quantity: 1,
  price: 100,
  gst: 12,
  received_quantity: 0,
};

describe('GET /api/po/:id', () => {
  let app: INestApplication;

  const get = (id: string) =>
    request(app.getHttpServer())
      .get(`/api/po/${id}`)
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
    for (const m of [getUser, profileMaybe, headerMaybe, secondOrder]) m.mockReset();
    for (const m of [from, forUser, headerEq, linesEq, firstOrder]) m.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'm@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
    headerMaybe.mockResolvedValue({ data: header, error: null });
    secondOrder.mockResolvedValue({ data: [line], error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get(`/api/po/${ID}`);
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('400 when the id is not a UUID, and nothing is read', async () => {
    const res = await get('hello');
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe('Must be a valid UUID');
    expect(from).not.toHaveBeenCalled();
  });

  it('403 for a requestor, and no PO data is read', async () => {
    profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
    const res = await get(ID);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'Only a manager or admin can view POs; requestors should use GET /po-lines/mine',
    );
    expect(from).not.toHaveBeenCalledWith('v_purchase_order');
    expect(from).not.toHaveBeenCalledWith('v_po_lines');
  });

  it('404 when the PO does not exist, and the lines are not read', async () => {
    headerMaybe.mockResolvedValue({ data: null, error: null });
    const res = await get(ID);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ statusCode: 404, error: 'NOT_FOUND', message: 'PO not found' });
    expect(from).not.toHaveBeenCalledWith('v_po_lines');
  });

  it.each(['manager', 'admin'])('200 for a %s with the header and its lines', async (role) => {
    profileMaybe.mockResolvedValue({ data: { role }, error: null });
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...header, lines: [line] });
  });

  it('reads by id, with the caller JWT, lines ordered by item then variant', async () => {
    await get(ID);
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(headerEq).toHaveBeenCalledWith('po_id', ID);
    expect(linesEq).toHaveBeenCalledWith('po_id', ID);
    expect(firstOrder).toHaveBeenCalledWith('item_name');
    expect(secondOrder).toHaveBeenCalledWith('variant_code');
  });

  it('200 with an empty lines array when there are none', async () => {
    secondOrder.mockResolvedValue({ data: null, error: null });
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual([]);
  });

  describe('500 when a read fails', () => {
    it('profile', async () => {
      profileMaybe.mockResolvedValue({ data: null, error: { message: 'profile boom' } });
      expect((await get(ID)).body.message).toBe('profile boom');
    });

    it('header', async () => {
      headerMaybe.mockResolvedValue({ data: null, error: { message: 'header boom' } });
      const res = await get(ID);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('header boom');
    });

    it('lines', async () => {
      secondOrder.mockResolvedValue({ data: null, error: { message: 'lines boom' } });
      const res = await get(ID);
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('lines boom');
    });
  });
});
