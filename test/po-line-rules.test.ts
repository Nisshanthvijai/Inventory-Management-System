import { RuleViolation } from '../src/domain/common/errors';
import { allowedPoQuantity, assertPoLineAllowed, PoLineCheck } from '../src/domain/po/po-line-rules';

// 1 box = 12 pcs; 24 pcs approved = 2 boxes.
const base: PoLineCheck = {
  name: 'BOLT-M6',
  prStatus: 'accepted',
  approved: 24,
  unitsPerPurchase: 12,
  stockUnit: 'pcs',
  purchaseUnit: 'box',
  alreadyOrderedStock: 0,
  quantity: 2,
};

const check = (over: Partial<PoLineCheck>) => () => assertPoLineAllowed({ ...base, ...over });

describe('allowedPoQuantity (pack rounding)', () => {
  it('rounds up to whole packs', () => {
    expect(allowedPoQuantity(5, 12)).toBe(1);
    expect(allowedPoQuantity(13, 12)).toBe(2);
  });

  it('keeps an exact number of packs as it is', () => {
    expect(allowedPoQuantity(12, 12)).toBe(1);
    expect(allowedPoQuantity(24, 12)).toBe(2);
  });

  it('does not round when one purchase unit is one stock unit', () => {
    expect(allowedPoQuantity(5, 1)).toBe(5);
    expect(allowedPoQuantity(2.5, 1)).toBe(2.5);
  });
});

describe('assertPoLineAllowed', () => {
  it('lets a line through that fits', () => {
    expect(check({})).not.toThrow();
  });

  it('allows the rounded-up pack count', () => {
    expect(check({ approved: 13, quantity: 2 })).not.toThrow();
  });

  it('rejects a PR line that is not accepted, with a 400', () => {
    expect(check({ prStatus: 'pending' })).toThrow(/only an accepted PR line/);
    try {
      check({ prStatus: 'rejected' })();
    } catch (e) {
      expect(e).toBeInstanceOf(RuleViolation);
    }
  });

  it('rejects part of a pack', () => {
    expect(check({ quantity: 1.5 })).toThrow(/whole number of box/);
  });

  it('allows a fraction when one purchase unit is one stock unit', () => {
    expect(check({ unitsPerPurchase: 1, approved: 2, quantity: 1.5 })).not.toThrow();
  });

  it('rejects more than the rounded-up amount', () => {
    expect(check({ quantity: 3 })).toThrow(/at most 2 box more/);
  });

  it('subtracts what is already on other POs', () => {
    // 12 pcs = 1 box already ordered, so only 1 box is left.
    expect(check({ alreadyOrderedStock: 12, quantity: 2 })).toThrow(/at most 1 box more/);
    expect(check({ alreadyOrderedStock: 12, quantity: 1 })).not.toThrow();
  });

  it('rejects anything once the line is fully ordered', () => {
    expect(check({ alreadyOrderedStock: 24, quantity: 1 })).toThrow(/at most 0 box more/);
  });
});
