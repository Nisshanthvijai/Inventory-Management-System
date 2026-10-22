import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const getUser = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const forUser = vi.fn(() => ({ rpc, from }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const row = {
  po_line_id: 'l1',
  po_id: 'po1',
  po_no: 'PO-2026-0001',
  po_status: 'open',
  vendor_name: 'LabWorld Traders',
  pr_no: 'PR-2026-0001',
  item_name: 'Examination Gloves',
  variant_code: 'GLV-ANS-NIT',
  purchase_unit: 'box',
  ordered_quantity: 2,
  received_same_variant: 0,
  received_other_variants: 0,
  is_complete: false,
  can_receive: true,
};

describe('GET /api/po-lines/mine', () => {
  let app: INestApplication;

  const get = () =>
    request(app.getHttpServer())
      .get('/api/po-lines/mine')
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
    getUser.mockReset();
    rpc.mockReset();
    from.mockClear();
    forUser.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'r@x.com' } }, error: null });
    rpc.mockResolvedValue({ data: [row], error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/po-lines/mine');
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('200 with the rows from get_my_po_lines, called with no arguments', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([row]);
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_my_po_lines');
  });

  it('never reads the PO tables directly (requestors cannot see prices there)', async () => {
    await get();
    expect(from).not.toHaveBeenCalled();
  });

  it('200 with an empty list when the caller has no PO lines', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 with an empty list when the RPC returns null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('500 with the standard shape when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rpc boom' } });
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'rpc boom',
    });
  });
});
