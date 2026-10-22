import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const getUser = vi.fn();
const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
const forUser = vi.fn(() => ({ from }));

const fakeSupabase = {
  anon: () => ({ auth: { getUser } }),
  forUser,
};

const base = {
  id: 'p1',
  pr_no: 'PR-2026-0001',
  pr_date: '2026-10-16',
  priority: 'medium',
  status: 'submitted',
  requested_by: 'u1',
  created_at: '2026-10-16T10:00:00Z',
};

describe('GET /api/pr', () => {
  let app: INestApplication;

  const get = () =>
    request(app.getHttpServer())
      .get('/api/pr')
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
    order.mockReset();
    from.mockClear();
    select.mockClear();
    forUser.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/pr');
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('200 reads purchase_requisition newest first with the caller JWT', async () => {
    order.mockResolvedValue({ data: [], error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(from).toHaveBeenCalledWith('purchase_requisition');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('flattens the requester name (object or list shape)', async () => {
    order.mockResolvedValue({
      data: [
        { ...base, id: 'p1', requester: { full_name: 'Asha' } },
        { ...base, id: 'p2', requester: [{ full_name: 'Ravi' }] },
      ],
      error: null,
    });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { ...base, id: 'p1', requested_by_name: 'Asha' },
      { ...base, id: 'p2', requested_by_name: 'Ravi' },
    ]);
  });

  it('requested_by_name is null when the profile is not visible', async () => {
    order.mockResolvedValue({ data: [{ ...base, requester: null }], error: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body[0].requested_by_name).toBeNull();
    expect(res.body[0]).not.toHaveProperty('requester');
  });

  it('500 with the standard error shape when Supabase fails', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'boom',
    });
  });
});
