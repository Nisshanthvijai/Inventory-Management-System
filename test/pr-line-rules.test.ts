import { ApiError } from '../src/domain/common/api-error';
import { assertApprovedWithinRequested, decisionFields } from '../src/domain/pr-lines/pr-line-rules';

describe('assertApprovedWithinRequested', () => {
  it('allows approving less than or exactly what was requested', () => {
    expect(() => assertApprovedWithinRequested({ status: 'accepted', approved_quantity: 3 }, 5)).not.toThrow();
    expect(() => assertApprovedWithinRequested({ status: 'accepted', approved_quantity: 5 }, 5)).not.toThrow();
  });

  it('rejects approving more than was requested, with a 400', () => {
    const run = () => assertApprovedWithinRequested({ status: 'accepted', approved_quantity: 6 }, 5);
    expect(run).toThrow('Approved quantity cannot exceed the requested quantity (5)');
    expect(run).toThrow(ApiError);
    try {
      run();
    } catch (e) {
      expect((e as ApiError).getStatus()).toBe(400);
    }
  });

  it('does not check quantities on a rejection', () => {
    expect(() =>
      assertApprovedWithinRequested({ status: 'rejected', rejection_comment: 'no budget' }, 5),
    ).not.toThrow();
  });
});

describe('decisionFields', () => {
  it('an acceptance sets the approved quantity and clears the rejection comment', () => {
    expect(decisionFields({ status: 'accepted', approved_quantity: 4 })).toEqual({
      status: 'accepted',
      approved_quantity: 4,
      rejection_comment: null,
    });
  });

  it('a rejection sets the comment and clears the approved quantity', () => {
    expect(decisionFields({ status: 'rejected', rejection_comment: 'no budget' })).toEqual({
      status: 'rejected',
      approved_quantity: null,
      rejection_comment: 'no budget',
    });
  });
});
