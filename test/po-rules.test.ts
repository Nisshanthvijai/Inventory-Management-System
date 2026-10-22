import { ApiError } from '../src/domain/common/api-error';
import { assertPoCancellable } from '../src/domain/po/po-rules';

describe('assertPoCancellable', () => {
  it('lets an open PO be cancelled', () => {
    expect(() => assertPoCancellable('PO-001', 'open')).not.toThrow();
  });

  it.each(['cancelled', 'partially_received', 'received'])('refuses a %s PO with a 409', (status) => {
    const run = () => assertPoCancellable('PO-001', status);
    expect(run).toThrow(`PO PO-001 is ${status}; only an open PO can be cancelled`);
    try {
      run();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).getStatus()).toBe(409);
    }
  });
});
