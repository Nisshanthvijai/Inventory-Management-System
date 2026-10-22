import { ApiError } from '../src/domain/common/api-error';
import { assertCanReceiveGoods } from '../src/domain/grn/grn-rules';

const statusOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiError ? e.getStatus() : 'not an ApiError';
  }
  return 'no error';
};

describe('assertCanReceiveGoods', () => {
  it.each(['requestor', 'admin'])('lets %s receive goods', (role) => {
    expect(() => assertCanReceiveGoods(role)).not.toThrow();
  });

  it('refuses a manager with its own message', () => {
    expect(() => assertCanReceiveGoods('manager')).toThrow(
      'A manager cannot receive goods; a requestor or admin can',
    );
    expect(statusOf(() => assertCanReceiveGoods('manager'))).toBe(403);
  });

  it.each([null, undefined, 'someone-else'])('refuses %s', (role) => {
    expect(() => assertCanReceiveGoods(role)).toThrow('Only a requestor or admin can receive goods');
    expect(statusOf(() => assertCanReceiveGoods(role))).toBe(403);
  });
});
