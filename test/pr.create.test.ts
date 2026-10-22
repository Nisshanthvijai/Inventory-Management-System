import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

const getUser = vi.fn();
const rpc = vi.fn();
const forUser = vi.fn(() => ({ rpc }));

const fakeSupabase = {
  anon: () => ({ auth: { getUser } }),
  forUser,
};

describe('POST /api/pr', () => {
  let app: INestApplication;

  const post = (body: unknown, token = 'good-token') =>
    request(app.getHttpServer())
      .post('/api/pr')
      .set('Authorization', `Bearer ${token}`)
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
    getUser.mockReset();
    rpc.mockReset();
    forUser.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pr')
      .send({ lines: [{ variant_id: V1, quantity: 1 }] });
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  describe('400 before the database is called', () => {
    it.each([
      ['no lines', { lines: [] }],
      ['lines missing', {}],
      ['quantity is 0', { lines: [{ variant_id: V1, quantity: 0 }] }],
      ['quantity is negative', { lines: [{ variant_id: V1, quantity: -2 }] }],
      ['variant_id is not a uuid', { lines: [{ variant_id: 'abc', quantity: 1 }] }],
      [
        'same variant twice',
        {
          lines: [
            { variant_id: V1, quantity: 1 },
            { variant_id: V1, quantity: 2 },
          ],
        },
      ],
      [
        'priority is unknown',
        { priority: 'urgent', lines: [{ variant_id: V1, quantity: 1 }] },
      ],
    ])('%s', async (_name, body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  it('201 and calls create_pr with the lines and the default priority', async () => {
    rpc.mockResolvedValue({
      data: { pr_id: 'p1', pr_no: 'PR-2026-0001', lines: 2 },
      error: null,
    });
    const lines = [
      { variant_id: V1, quantity: 3 },
      { variant_id: V2, quantity: 1.5 },
    ];
    const res = await post({ lines });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ pr_id: 'p1', pr_no: 'PR-2026-0001', lines: 2 });
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(rpc).toHaveBeenCalledWith('create_pr', {
      p_lines: lines,
      p_priority: 'medium',
    });
  });

  it('passes a chosen priority through', async () => {
    rpc.mockResolvedValue({ data: { pr_id: 'p1', pr_no: 'x', lines: 1 }, error: null });
    await post({ priority: 'high', lines: [{ variant_id: V1, quantity: 1 }] });
    expect(rpc).toHaveBeenCalledWith('create_pr', {
      p_lines: [{ variant_id: V1, quantity: 1 }],
      p_priority: 'high',
    });
  });

  describe('database errors become clear ApiErrors', () => {
    const body = { lines: [{ variant_id: V1, quantity: 1 }] };

    it.each([
      ['P0001', 'A PR needs at least one line', 400, 'A PR needs at least one line'],
      ['42501', 'row-level security', 403, 'You cannot create a PR'],
      ['23503', 'fk violation', 400, 'Unknown item variant'],
      ['XX000', 'internal', 500, 'internal'],
    ])('%s -> %i', async (code, dbMessage, status, message) => {
      rpc.mockResolvedValue({ data: null, error: { code, message: dbMessage } });
      const res = await post(body);
      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
    });
  });
});
