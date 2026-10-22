import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const signInWithPassword = vi.fn();
const fakeSupabase = {
  anon: () => ({ auth: { signInWithPassword } }),
};

describe('POST /api/auth/login', () => {
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

  beforeEach(() => signInWithPassword.mockReset());

  it('400 when email is invalid', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('400 when password is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('401 when Supabase rejects the credentials', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('200 with tokens and user on success', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
        user: { id: 'u1', email: 'a@b.com' },
      },
      error: null,
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3600,
      user: { id: 'u1', email: 'a@b.com' },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret',
    });
  });
});
