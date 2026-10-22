import { z } from 'zod';
import { UnexpectedError } from '../src/application/common/errors';
import { parseRpcResult } from '../src/infrastructure/supabase/rpc-result';

// The same shape the repositories use for create_po / create_pr / create_grn.
const created = z.looseObject({ po_id: z.string(), po_no: z.string(), lines: z.number() });

describe('parseRpcResult', () => {
  it('returns the RPC result when it has the expected shape', () => {
    const data = { po_id: 'po1', po_no: 'PO-2026-0001', lines: 2 };
    expect(parseRpcResult(created, data, 'create_po')).toEqual(data);
  });

  it('keeps extra fields the function returns (responses do not change)', () => {
    const data = { po_id: 'po1', po_no: 'PO-2026-0001', lines: 2, total: 99 };
    expect(parseRpcResult(created, data, 'create_po')).toEqual(data);
  });

  it.each([null, {}, { po_id: 'po1', po_no: 'x' }, { po_id: 1, po_no: 'x', lines: 1 }])(
    'throws UnexpectedError for %o',
    (data) => {
      const run = () => parseRpcResult(created, data, 'create_po');
      expect(run).toThrow(UnexpectedError);
      expect(run).toThrow('create_po returned an unexpected result');
    },
  );
});
