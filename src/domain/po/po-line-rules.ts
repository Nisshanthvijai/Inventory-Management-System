import { RuleViolation } from '../common/errors';

// Numbers from the database are exact decimals; compare with a tiny tolerance.
const EPS = 1e-9;

/** Pack rounding: approved stock units are rounded UP to whole packs, then expressed in purchase units. */
export function allowedPoQuantity(approved: number, unitsPerPurchase: number): number {
  return unitsPerPurchase > 1 ? Math.ceil(approved / unitsPerPurchase) : approved / unitsPerPurchase;
}

export interface PoLineCheck {
  name: string; // variant code, used in messages
  prStatus: string;
  approved: number; // approved quantity, in the stock unit
  unitsPerPurchase: number;
  stockUnit: string;
  purchaseUnit: string;
  alreadyOrderedStock: number; // stock units already on other (non-cancelled) POs
  quantity: number; // what the PO line asks for, in the purchase unit
}

/** Throws 400 unless this PO line may be ordered. Pure: no database, no HTTP. */
export function assertPoLineAllowed(c: PoLineCheck): void {
  if (c.prStatus !== 'accepted') {
    throw new RuleViolation(`${c.name}: only an accepted PR line can be ordered (this one is ${c.prStatus})`);
  }

  // Packs cannot be split.
  if (c.unitsPerPurchase > 1 && !Number.isInteger(c.quantity)) {
    throw new RuleViolation(
      `${c.name}: quantity must be a whole number of ${c.purchaseUnit} (1 ${c.purchaseUnit} = ${c.unitsPerPurchase} ${c.stockUnit}); got ${c.quantity}`,
    );
  }

  const allowed = allowedPoQuantity(c.approved, c.unitsPerPurchase);
  const alreadyOrdered = c.alreadyOrderedStock / c.unitsPerPurchase;
  const remaining = allowed - alreadyOrdered;

  if (c.quantity > remaining + EPS) {
    throw new RuleViolation(
      `${c.name}: you can order at most ${Math.max(remaining, 0)} ${c.purchaseUnit} more ` +
        `(approved ${c.approved} ${c.stockUnit} = ${allowed} ${c.purchaseUnit} rounded up to whole packs, ` +
        `${alreadyOrdered} already ordered); got ${c.quantity}`,
    );
  }
}
