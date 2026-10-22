import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MASTER_RESOURCES } from '../src/application/master/master.resources';
import { MASTER_TABLES } from '../src/infrastructure/supabase/repositories/supabase-master.repository';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';
import { MASTER_PATHS } from '../src/presentation/master/master.routes';
import { setupApp } from '../src/setup';
import { makeFakeDb } from './fake-db';

// Each resource as one test case: application config + its table (infrastructure) + its URL path.
const CASES = MASTER_RESOURCES.map((r) => ({ ...r, ...MASTER_TABLES[r.key], path: MASTER_PATHS[r.key] }));

const U = '11111111-1111-4111-8111-111111111111';
const fake = makeFakeDb();

// A valid create body for each resource.
const validBody: Record<string, object> = {
  uoms: { code: 'BOX', name: 'Box' },
  brands: { name: 'Cipla' },
  categories: { name: 'Medicine' },
  'item-types': { name: 'Tablet' },
  items: { name: 'Paracetamol', category_id: U },
  variants: {
    code: 'PARA-CIP-TAB',
    item_id: U,
    brand_id: U,
    type_id: U,
    inventory_uom_id: U,
    purchase_uom_id: U,
    units_per_purchase: 10,
  },
  vendors: { name: 'LabWorld Traders', gst_no: '29ABCDE1234F1Z5' },
};

describe('master data', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const auth = { Authorization: 'Bearer good-token' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(fake.supabase)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => fake.reset('admin'));

  it('has a valid body for every resource in this test', () => {
    expect(Object.keys(validBody).sort()).toEqual(CASES.map((r) => r.path).sort());
  });

  describe.each(CASES)('/api/$path', (r) => {
    const url = `/api/${r.path}`;
    const label = r.label;

    it('401 without a token', async () => {
      expect((await http().get(url)).status).toBe(401);
      expect(fake.from).not.toHaveBeenCalled();
    });

    describe('GET (list)', () => {
      it(`reads ${r.listFrom ?? r.table}, ordered by ${r.order.join(', ')}`, async () => {
        fake.listResult.mockReturnValue({ data: [{ id: 'a' }], error: null });
        const res = await http().get(url).set(auth);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: 'a' }]);
        expect(fake.from).toHaveBeenCalledWith(r.listFrom ?? r.table);
        expect(fake.order.mock.calls.map((c) => c[0])).toEqual(r.order);
      });

      if (!r.readPermission) {
        it('allows a requestor', async () => {
          fake.reset('requestor');
          expect((await http().get(url).set(auth)).status).toBe(200);
        });
      } else {
        it('403 for a requestor; manager allowed', async () => {
          fake.reset('requestor');
          const res = await http().get(url).set(auth);
          expect(res.status).toBe(403);
          expect(res.body.message).toBe(`Only a manager or admin can view ${label}s`);
          fake.reset('manager');
          expect((await http().get(url).set(auth)).status).toBe(200);
        });
      }

      it('500 when the read fails', async () => {
        fake.listResult.mockReturnValue({ data: null, error: { message: 'list boom' } });
        const res = await http().get(url).set(auth);
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Something went wrong');
      });
    });

    describe('POST (create, admin only)', () => {
      it('201 inserts into the table and returns the row', async () => {
        fake.insertSingle.mockResolvedValue({ data: { id: 'new', ...validBody[r.path] }, error: null });
        const res = await http().post(url).set(auth).send(validBody[r.path]);
        expect(res.status).toBe(201);
        expect(res.body.id).toBe('new');
        expect(fake.from).toHaveBeenCalledWith(r.table);
        expect(fake.insert).toHaveBeenCalledWith(validBody[r.path]);
        expect(fake.insertSelect).toHaveBeenCalledWith(r.select);
      });

      it.each(['manager', 'requestor'])('403 for a %s, nothing inserted', async (role) => {
        fake.reset(role);
        const res = await http().post(url).set(auth).send(validBody[r.path]);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe(`Only an admin can create or change ${label}s`);
        expect(fake.insert).not.toHaveBeenCalled();
      });

      it('400 for an empty body or an unknown field, before any database call', async () => {
        expect((await http().post(url).set(auth).send({})).status).toBe(400);
        const extra = await http().post(url).set(auth).send({ ...validBody[r.path], id: U });
        expect(extra.status).toBe(400);
        expect(fake.from).not.toHaveBeenCalled();
      });
    });

    describe('PATCH /:id (update, admin only)', () => {
      it('200 updates by id and returns the row', async () => {
        fake.updateMaybe.mockResolvedValue({ data: { id: U, is_active: false }, error: null });
        const res = await http().patch(`${url}/${U}`).set(auth).send({ is_active: false });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: U, is_active: false });
        expect(fake.update).toHaveBeenCalledWith({ is_active: false });
        expect(fake.updateEq).toHaveBeenCalledWith('id', U);
      });

      it('400 for an empty body', async () => {
        const res = await http().patch(`${url}/${U}`).set(auth).send({});
        expect(res.status).toBe(400);
        expect(res.body.details[0].message).toBe('Send at least one field to change');
        expect(fake.from).not.toHaveBeenCalled();
      });

      it('400 for a bad id', async () => {
        expect((await http().patch(`${url}/abc`).set(auth).send({ is_active: false })).status).toBe(400);
      });

      it('404 when no row has that id', async () => {
        fake.updateMaybe.mockResolvedValue({ data: null, error: null });
        const res = await http().patch(`${url}/${U}`).set(auth).send({ is_active: false });
        expect(res.status).toBe(404);
        expect(res.body.message.toLowerCase()).toBe(`${label} not found`);
      });

      it('403 for a manager, nothing updated', async () => {
        fake.reset('manager');
        expect((await http().patch(`${url}/${U}`).set(auth).send({ is_active: false })).status).toBe(403);
        expect(fake.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('database write errors become clear ApiErrors (brands as the example)', () => {
    it.each([
      ['23505', 'duplicate key', 409, 'A brand with these values already exists'],
      ['23503', 'fk', 400, 'A referenced record does not exist'],
      ['23514', 'violates check constraint "brand_name_check"', 400, 'violates check constraint "brand_name_check"'],
      ['P0001', 'some trigger rule', 409, 'some trigger rule'],
      ['42501', 'rls', 403, 'Only an admin can create or change brands'],
      ['XX000', 'internal', 500, 'Something went wrong'],
    ])('%s -> %i', async (code, message, status, expected) => {
      fake.insertSingle.mockResolvedValue({ data: null, error: { code, message } });
      const res = await http().post('/api/brands').set(auth).send({ name: 'X' });
      expect(res.status).toBe(status);
      expect(res.body.message).toBe(expected);
    });
  });

  describe('resource-specific rules', () => {
    it('variants: a used variant cannot change its units (409 with the database message)', async () => {
      const msg = 'Variant PARA-CIP-TAB is used on a PR, PO or GRN: its item, brand, type, units and conversion cannot be changed. Add a new variant and retire this one instead.';
      fake.updateMaybe.mockResolvedValue({ data: null, error: { code: 'P0001', message: msg } });
      const res = await http().patch(`/api/variants/${U}`).set(auth).send({ units_per_purchase: 12 });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe(msg);
    });

    it.each([
      ['units_per_purchase 0', { units_per_purchase: 0 }],
      ['negative reorder level', { reorder_level: -1 }],
      ['item_id not a uuid', { item_id: 'x' }],
    ])('variants: 400 for %s', async (_n, patch) => {
      const res = await http().post('/api/variants').set(auth).send({ ...validBody.variants, ...patch });
      expect(res.status).toBe(400);
    });

    it('vendors: GSTIN is upper-cased before the check', async () => {
      await http().post('/api/vendors').set(auth).send({ name: 'V', gst_no: '29abcde1234f1z5' });
      expect(fake.insert).toHaveBeenCalledWith({ name: 'V', gst_no: '29ABCDE1234F1Z5' });
    });

    it.each([
      ['a bad GSTIN', { gst_no: 'ABC' }],
      ['a bad email', { email: 'not-an-email' }],
      ['a blank name', { name: '  ' }],
    ])('vendors: 400 for %s', async (_n, patch) => {
      const res = await http().post('/api/vendors').set(auth).send({ ...validBody.vendors, ...patch });
      expect(res.status).toBe(400);
      expect(fake.insert).not.toHaveBeenCalled();
    });

    it('items: description can be cleared with null', async () => {
      await http().patch(`/api/items/${U}`).set(auth).send({ description: null });
      expect(fake.update).toHaveBeenCalledWith({ description: null });
    });
  });
});
