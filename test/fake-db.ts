/**
 * A small fake Supabase client for the generic master-data, users and stock tests.
 * Every query result is a vi.fn() the test controls; every call is recorded.
 */
export function makeFakeDb() {
  const profileMaybe = vi.fn(); // profile role: select().eq().maybeSingle()

  // list: select(cols).order(c)...  -> awaited
  const listResult = vi.fn();
  const order = vi.fn();
  const listBuilder: Record<string, unknown> = {
    order: (...args: unknown[]) => {
      order(...args);
      return listBuilder;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(listResult()).then(resolve, reject),
  };
  const listSelect = vi.fn((_cols: string) => listBuilder);

  // create: insert(dto).select(cols).single()
  const insertSingle = vi.fn();
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  // update: update(dto).eq('id', id).select(cols).maybeSingle()
  const updateMaybe = vi.fn();
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybe }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));

  // read one: select(cols).eq(col, v).maybeSingle()  (used by stock read-back)
  const readMaybe = vi.fn();
  const readEq = vi.fn(() => ({ maybeSingle: readMaybe }));

  const from = vi.fn((table: string) => {
    if (table === 'profile') {
      return {
        select: (cols: string) =>
          cols === 'role'
            ? { eq: () => ({ maybeSingle: profileMaybe }) }
            : listSelect(cols),
        update,
      };
    }
    return {
      select: (cols: string) => Object.assign(listSelect(cols), { eq: readEq }),
      insert,
      update,
    };
  });

  const getUser = vi.fn();
  const forUser = vi.fn(() => ({ from }));
  const supabase = { anon: () => ({ auth: { getUser } }), forUser };

  const all = {
    profileMaybe, listResult, order, listSelect, insertSingle, insertSelect, insert,
    updateMaybe, updateSelect, updateEq, update, readMaybe, readEq, from, getUser, forUser,
  };

  /** Reset everything and set the defaults: caller u1 with the given role, empty successes. */
  function reset(role: string | null = 'admin') {
    for (const m of Object.values(all)) m.mockClear();
    for (const m of [profileMaybe, listResult, insertSingle, updateMaybe, readMaybe, getUser]) {
      m.mockReset();
    }
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'x@x.com' } }, error: null });
    profileMaybe.mockResolvedValue({ data: role ? { role } : null, error: null });
    listResult.mockReturnValue({ data: [], error: null });
    insertSingle.mockResolvedValue({ data: { id: 'new' }, error: null });
    updateMaybe.mockResolvedValue({ data: { id: 'row' }, error: null });
    readMaybe.mockResolvedValue({ data: { id: 'row' }, error: null });
  }

  return { supabase, reset, ...all };
}
