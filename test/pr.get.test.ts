import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { SupabaseService } from '../src/infrastructure/supabase/supabase.service';

const ID = '11111111-1111-4111-8111-111111111111';

const getUser = vi.fn();

// header query: from('purchase_requisition').select().eq().maybeSingle()
const maybeSingle = vi.fn();
const headerEq = vi.fn(() => ({ maybeSingle }));
const headerSelect = vi.fn(() => ({ eq: headerEq }));

// lines query: from('v_pr_lines').select().eq().order().order()
const secondOrder = vi.fn();
const firstOrder = vi.fn(() => ({ order: secondOrder }));
const linesEq = vi.fn(() => ({ order: firstOrder }));
const linesSelect = vi.fn(() => ({ eq: linesEq }));

const from = vi.fn((table: string) =>
  table === 'purchase_requisition'
    ? { select: headerSelect }
    : { select: linesSelect },
);
const forUser = vi.fn(() => ({ from }));

const fakeSupabase = {
  anon: () => ({ auth: { getUser } }),
  forUser,
};

const header = {
  id: ID,
  pr_no: 'PR-2026-0001',
  pr_date: '2026-10-16',
  priority: 'medium',
  status: 'submitted',
  requested_by: 'u1',
  created_at: '2026-10-16T10:00:00Z',
};
const line = {
  pr_line_id: 'l1',
  pr_id: ID,
  item_name: 'Examination Gloves',
  quantity: 2,
  line_status: 'pending',
};

describe('GET /api/pr/:id', () => {
  let app: INestApplication;

  const get = (id: string) =>
    request(app.getHttpServer())
      .get(`/api/pr/${id}`)
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
    for (const m of [getUser, maybeSingle, secondOrder]) m.mockReset();
    for (const m of [from, forUser, headerEq, linesEq, firstOrder]) m.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });
  });

  it('401 without a token', async () => {
    const res = await request(app.getHttpServer()).get(`/api/pr/${ID}`);
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('400 when the id is not a UUID, and the database is not called', async () => {
    const res = await get('hello');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.details[0].message).toBe('Must be a valid UUID');
    expect(from).not.toHaveBeenCalled();
  });

  it('404 when the PR is not visible, and the lines are not read', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await get(ID);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'PR not found',
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('purchase_requisition');
  });

  it('200 with the header, requester name and lines', async () => {
    maybeSingle.mockResolvedValue({
      data: { ...header, requester: { full_name: 'Asha' } },
      error: null,
    });
    secondOrder.mockResolvedValue({ data: [line], error: null });
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ...header,
      requested_by_name: 'Asha',
      lines: [line],
    });
    expect(forUser).toHaveBeenCalledWith('good-token');
    expect(headerEq).toHaveBeenCalledWith('id', ID);
    expect(from).toHaveBeenCalledWith('v_pr_lines');
    expect(linesEq).toHaveBeenCalledWith('pr_id', ID);
  });

  it('200 with an empty lines array when there are none', async () => {
    maybeSingle.mockResolvedValue({ data: { ...header, requester: null }, error: null });
    secondOrder.mockResolvedValue({ data: [], error: null });
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(res.body.requested_by_name).toBeNull();
    expect(res.body.lines).toEqual([]);
  });

  it('500 when the header query fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'header boom' } });
    const res = await get(ID);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('header boom');
  });

  it('500 when the lines query fails', async () => {
    maybeSingle.mockResolvedValue({
      data: { ...header, requester: null },
      error: null,
    });
    secondOrder.mockResolvedValue({ data: null, error: { message: 'lines boom' } });
    const res = await get(ID);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('lines boom');
  });
});
