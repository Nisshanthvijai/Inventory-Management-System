import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const signInWithPassword = vi.fn();
let crash = false;
const fakeSupabase = {
  anon: () => ({
    auth: {
      // Throw from a plain function: the same throw from a vi.fn failed the test even though the filter returned 500.
      signInWithPassword: async (...args: unknown[]) => {
        if (crash) throw new Error('db password is hunter2');
        return signInWithPassword(...args);
      },
    },
  }),
};

describe('error shape (AllExceptionsFilter)', () => {
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
    crash = false;
    signInWithPassword.mockReset();
  });

  it('400: ApiError details carry the validation issues', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
      details: [{ path: 'email', message: expect.any(String) }],
    });
  });

  it('401: ApiError from the service has no details field', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  });

  it('401: the guard error uses the same shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing bearer token',
    });
  });

  it('404: unknown route uses the same shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('500: unexpected crash is hidden from the client', async () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    crash = true;
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
