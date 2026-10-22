/**
 * End-to-end: the real app against the REAL Supabase project, one full purchase flow.
 *
 * WARNING: this writes real rows (a PR, a PO and a GRN, each with a real document number).
 * They are not cleaned up: a PO with goods received cannot be deleted or cancelled.
 *
 * Needs .env.e2e.local (see .env.e2e.example). Without it, every test is skipped.
 */
import { existsSync } from 'node:fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';

if (existsSync('.env.e2e.local')) process.loadEnvFile('.env.e2e.local');

const env = (k: string) => process.env[k] ?? '';
const users = {
  admin: { email: env('E2E_ADMIN_EMAIL'), password: env('E2E_ADMIN_PASSWORD') },
  manager: { email: env('E2E_MANAGER_EMAIL'), password: env('E2E_MANAGER_PASSWORD') },
  requestor: { email: env('E2E_REQUESTOR_EMAIL'), password: env('E2E_REQUESTOR_PASSWORD') },
};
const configured = Object.values(users).every((u) => u.email && u.password);

type Role = keyof typeof users;

describe.skipIf(!configured)('e2e: PR → decision → PO → GRN (real Supabase)', () => {
  let app: INestApplication;
  const token: Partial<Record<Role, string>> = {};

  // Filled in as the flow goes.
  let variant: { variant_id: string; units_per_purchase: number };
  let prId: string;
  let prLineId: string;
  let requested: number; // stock units
  let allowedPacks: number; // purchase units
  let poId: string;
  let poLineId: string;

  const as = (role: Role) => {
    const http = request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${token[role]}` };
    return {
      get: (url: string) => http.get(`/api${url}`).set(auth),
      post: (url: string, body?: object) => http.post(`/api${url}`).set(auth).send(body),
      patch: (url: string, body: object) => http.patch(`/api${url}`).set(auth).send(body),
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('health is open', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
  });

  it.each(['admin', 'manager', 'requestor'] as Role[])('%s logs in and /me has that role', async (role) => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(users[role]);
    expect(login.status).toBe(200);
    token[role] = login.body.access_token;

    const me = await as(role).get('/users/me');
    expect(me.status).toBe(200);
    expect(me.body.role).toBe(role);
  });

  it('a requestor can read stock but not POs or vendors', async () => {
    expect((await as('requestor').get('/stock')).status).toBe(200);
    expect((await as('requestor').get('/po')).status).toBe(403);
    expect((await as('requestor').get('/vendors')).status).toBe(403);
  });

  it('picks an orderable variant (a pack of more than 1 if there is one)', async () => {
    const res = await as('requestor').get('/variants');
    expect(res.status).toBe(200);
    const orderable = (res.body as Array<{ orderable: boolean; units_per_purchase: number | string; variant_id: string }>)
      .filter((v) => v.orderable)
      .map((v) => ({ variant_id: v.variant_id, units_per_purchase: Number(v.units_per_purchase) }));
    expect(orderable.length).toBeGreaterThan(0);
    variant = orderable.find((v) => v.units_per_purchase > 1) ?? orderable[0];

    // Ask for one more than a whole number of packs, so pack rounding has something to do.
    const units = variant.units_per_purchase;
    requested = units > 1 ? units + 1 : 3;
    allowedPacks = units > 1 ? Math.ceil(requested / units) : requested / units;
  });

  it('the requestor creates a PR', async () => {
    const res = await as('requestor').post('/pr', {
      priority: 'low',
      lines: [{ variant_id: variant.variant_id, quantity: requested }],
    });
    expect(res.status).toBe(201);
    prId = res.body.pr_id;

    const pr = await as('requestor').get(`/pr/${prId}`);
    expect(pr.status).toBe(200);
    expect(pr.body.lines).toHaveLength(1);
    prLineId = pr.body.lines[0].pr_line_id;
  });

  it('only a manager or admin can decide the line', async () => {
    const mine = await as('requestor').patch(`/pr-lines/${prLineId}`, {
      status: 'accepted',
      approved_quantity: requested,
    });
    expect(mine.status).toBe(403);

    const tooMuch = await as('manager').patch(`/pr-lines/${prLineId}`, {
      status: 'accepted',
      approved_quantity: requested + 1,
    });
    expect(tooMuch.status).toBe(400);

    const ok = await as('manager').patch(`/pr-lines/${prLineId}`, {
      status: 'accepted',
      approved_quantity: requested,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.line_status).toBe('accepted');
  });

  it('PO creation applies pack rounding', async () => {
    const vendors = await as('manager').get('/vendors');
    const vendor = (vendors.body as Array<{ id: string; is_active: boolean }>).find((v) => v.is_active);
    expect(vendor).toBeDefined();
    const body = (quantity: number) => ({
      vendor_id: vendor!.id,
      comments: 'e2e test',
      lines: [{ pr_line_id: prLineId, price: 1, quantity }],
    });

    expect((await as('requestor').post('/po', body(1))).status).toBe(403);

    const over = await as('manager').post('/po', body(allowedPacks + 1));
    expect(over.status).toBe(400);
    expect(over.body.message).toContain('you can order at most');

    if (variant.units_per_purchase > 1) {
      expect((await as('manager').post('/po', body(1.5))).status).toBe(400); // whole packs only
    }

    const ok = await as('manager').post('/po', body(allowedPacks));
    expect(ok.status).toBe(201);
    poId = ok.body.po_id;

    const again = await as('manager').post('/po', body(1));
    expect(again.status).toBe(400); // fully ordered now
  });

  it('the manager sees the PO with prices; the requestor sees their line without prices', async () => {
    const po = await as('manager').get(`/po/${poId}`);
    expect(po.status).toBe(200);
    expect(po.body.lines).toHaveLength(1);
    poLineId = po.body.lines[0].po_line_id;
    expect(po.body.lines[0]).toHaveProperty('price');

    const mine = await as('requestor').get('/po-lines/mine');
    expect(mine.status).toBe(200);
    const line = (mine.body as Array<Record<string, unknown>>).find((l) => l.po_line_id === poLineId);
    expect(line).toBeDefined();
    expect(line).not.toHaveProperty('price');
    expect(line!.can_receive).toBe(true);
  });

  it('goods are received by the requestor, never by a manager, and never beyond the order', async () => {
    const body = (received_quantity: number) => ({
      po_id: poId,
      invoice_no: `E2E-${Date.now()}`,
      lines: [{ po_line_id: poLineId, variant_id: variant.variant_id, received_quantity }],
    });

    expect((await as('manager').post('/grn', body(1))).status).toBe(403);

    const over = await as('requestor').post('/grn', body(allowedPacks + 1));
    expect(over.status).toBe(400);

    const ok = await as('requestor').post('/grn', body(1));
    expect(ok.status).toBe(201);

    const list = await as('requestor').get('/grn');
    expect(list.status).toBe(200);
    expect((list.body as Array<{ id: string }>).some((g) => g.id === ok.body.grn_id)).toBe(true);
  });

  it('a PO with goods received cannot be cancelled', async () => {
    const res = await as('manager').post(`/po/${poId}/cancel`);
    expect(res.status).toBe(409);
  });
});

describe.runIf(!configured)('e2e', () => {
  it.skip('skipped: create .env.e2e.local from .env.e2e.example to run against Supabase', () => {});
});
