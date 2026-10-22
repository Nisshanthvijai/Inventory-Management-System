import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const getUser = vi.fn();
const profileMaybe = vi.fn(); // profile: select().eq().maybeSingle()
const order = vi.fn(); // v_purchase_order: select().order()
const viewSelect = vi.fn(() => ({ order }));

const from = vi.fn((table: string) => {
  if (table === 'profile') {
    return { select: () => ({ eq: () => ({ maybeSingle: profileMaybe }) }) };
  }
  if (table === 'v_purchase_order') return { select: viewSelect };
  throw new Error(`unexpected table ${table}`);
});
const forUser = vi.fn(() => ({ from }));
const fakeSupabase = { anon: () => ({ auth: { getUser } }), forUser };

const row = {
  po_id: 'po1',
  po_no: 'PO-2026-0001',
  status: 'open',
  vendor_name: 'LabWorld Traders',
  against_pr: 'PR-2026-0001',
  line_count: 2,
  total_before_gst: 200,
  total_with_gst: 224,
};

describe('GET /api/po', () => {
  let app: INestApplication;

  const get = () =>
    request(app.getHttpServer()).get('/api/po').set('Authorization', 'Bearer good-token');

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
    for (const m of [getUser, profileMaybe, order]) m.mockReset();
    for (const m of [from, forUser, viewSelect]) m.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'm@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: { role: 'manager' }, error: null });
    order.mockResolvedValue({ data: [row], error: null });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/po');
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('403 for a requestor, and the PO view is never read', async () => {
    profileMaybe.mockResolvedValue({ data: { role: 'requestor' }, error: null });
    const res = await get();
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'Only a manager or admin can view POs; requestors should use GET /po-lines/mine',
    );
    expect(from).not.toHaveBeenCalledWith('v_purchase_order');
  });

  it('403 when the caller has no profile', async () => {
    profileMaybe.mockResolvedValue({ data: null, error: null });
    expect((await get()).status).toBe(403);
    expect(from).not.toHaveBeenCalledWith('v_purchase_order');
  });

  it.each(['manager', 'admin'])('200 for a %s with the PO rows', async (role) => {
    profileMaybe.mockResolvedValue({ data: { role }, error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([row]);
  });

  it('reads v_purchase_order newest first, with the caller JWT', async () => {
    await get();
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(from).toHaveBeenCalledWith('v_purchase_order');
    expect(viewSelect).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('200 with an empty list when there are no POs', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('500 with the standard shape when the profile read fails', async () => {
    profileMaybe.mockResolvedValue({ data: null, error: { message: 'profile boom' } });
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('profile boom');
  });

  it('500 with the standard shape when the view read fails', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'view boom' } });
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'view boom',
    });
  });
});
