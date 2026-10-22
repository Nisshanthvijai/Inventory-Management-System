import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';

const ALLOWED = 'http://localhost:5173';
const OTHER = 'https://evil.example.com';

// setupApp reads CORS_ORIGINS once, when the app is built; process.env wins over .env.local.
async function appWith(corsOrigins: string): Promise<INestApplication> {
  process.env.CORS_ORIGINS = corsOrigins;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

function preflight(app: INestApplication, origin: string) {
  return request(app.getHttpServer())
    .options('/api/health')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'GET');
}

describe('CORS', () => {
  const saved = process.env.CORS_ORIGINS;

  afterAll(() => {
    if (saved === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = saved;
  });

  describe('with CORS_ORIGINS set', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await appWith(` ${ALLOWED} , https://ims.example.com,`);
    });
    afterAll(() => app.close());

    it('allows a listed origin (preflight and request)', async () => {
      const pre = await preflight(app, ALLOWED);
      expect(pre.status).toBe(204);
      expect(pre.headers['access-control-allow-origin']).toBe(ALLOWED);

      const res = await request(app.getHttpServer()).get('/api/health').set('Origin', ALLOWED);
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    });

    it('also allows the second listed origin', async () => {
      const pre = await preflight(app, 'https://ims.example.com');
      expect(pre.headers['access-control-allow-origin']).toBe('https://ims.example.com');
    });

    it('gives no CORS header to any other origin', async () => {
      const pre = await preflight(app, OTHER);
      expect(pre.headers['access-control-allow-origin']).toBeUndefined();
      const res = await request(app.getHttpServer()).get('/api/health').set('Origin', OTHER);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('with CORS_ORIGINS empty', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await appWith('');
    });
    afterAll(() => app.close());

    it('gives no CORS header to any origin; same-origin and Postman calls still work', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').set('Origin', ALLOWED);
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect((await preflight(app, ALLOWED)).headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
