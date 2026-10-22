import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const getUser = vi.fn();
const secondOrder = vi.fn();
const firstOrder = vi.fn(() => ({ order: secondOrder }));
const select = vi.fn(() => ({ order: firstOrder }));
const from = vi.fn(() => ({ select }));
const forUser = vi.fn(() => ({ from }));

const fakeSupabase = {
  anon: () => ({ auth: { getUser } }),
  forUser,
};

const row = {
  stock_id: 's1',
  variant_id: 'v1',
  variant_code: 'LNS-10X',
  item_name: 'Objective lens',
  quantity: 4,
  stock_unit: 'pcs',
  reorder_level: 5,
  at_or_below_reorder: true,
};

describe('GET /api/stock', () => {
  let app: INestApplication;

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
    secondOrder.mockReset();
    forUser.mockClear();
    from.mockClear();
    select.mockClear();
    firstOrder.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/stock');
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('200 with rows from v_stock, ordered, using the caller JWT', async () => {
    secondOrder.mockResolvedValue({ data: [row], error: null });
    const res = await request(app.getHttpServer())
      .get('/api/stock')
      .set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([row]);
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(from).toHaveBeenCalledWith('v_stock');
    expect(firstOrder).toHaveBeenCalledWith('item_name');
    expect(secondOrder).toHaveBeenCalledWith('variant_code');
  });

  it('500 with the standard error shape when Supabase fails', async () => {
    secondOrder.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await request(app.getHttpServer())
      .get('/api/stock')
      .set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'boom',
    });
  });
});
