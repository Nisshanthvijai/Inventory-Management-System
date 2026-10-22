import { UnexpectedError } from '../src/application/common/errors';
import { parseRpcResult } from '../src/application/common/rpc-result';
import { poCreatedSchema } from '../src/application/po/po.types';

describe('parseRpcResult', () => {
  it('returns the RPC result when it has the expected shape', () => {
    const data = { po_id: 'po1', po_no: 'PO-2026-0001', lines: 2 };
    expect(parseRpcResult(poCreatedSchema, data, 'create_po')).toEqual(data);
  });

  it('keeps extra fields the function returns (responses do not change)', () => {
    const data = { po_id: 'po1', po_no: 'PO-2026-0001', lines: 2, total: 99 };
    expect(parseRpcResult(poCreatedSchema, data, 'create_po')).toEqual(data);
  });

  it.each([null, {}, { po_id: 'po1', po_no: 'x' }, { po_id: 1, po_no: 'x', lines: 1 }])(
    'throws UnexpectedError for %o',
    (data) => {
      const run = () => parseRpcResult(poCreatedSchema, data, 'create_po');
      expect(run).toThrow(UnexpectedError);
      expect(run).toThrow('create_po returned an unexpected result');
    },
  );
});
