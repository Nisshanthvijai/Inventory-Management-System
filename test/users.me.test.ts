import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const forUser = vi.fn(() => ({ from }));

const fakeSupabase = {
  anon: () => ({ auth: { getUser } }),
  forUser,
};

describe('GET /api/users/me', () => {
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
    maybeSingle.mockReset();
    forUser.mockClear();
    eq.mockClear();
  });

  it('401 without an Authorization header', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('401 when the header is not a Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('401 when Supabase says the token is invalid', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('200 with the profile, using the caller JWT', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: { id: 'u1', full_name: 'Asha', role: 'manager', is_active: true },
      error: null,
    });
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'u1',
      full_name: 'Asha',
      role: 'manager',
      is_active: true,
      email: 'a@b.com',
    });
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('500 (not 403) when the profile read fails', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_SERVER_ERROR');
  });

  it('403 when the user has no profile row', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u2', email: 'c@d.com' } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(403);
  });
});
