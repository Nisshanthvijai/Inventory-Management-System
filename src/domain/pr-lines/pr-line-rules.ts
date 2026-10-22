import { RuleViolation } from '../common/errors';
import { PrLineStatus } from './pr-line-status';

/** A manager's decision on one PR line. Same shape as DecideLineDto. */
export type LineDecision =
  | { status: 'accepted'; approved_quantity: number }
  | { status: 'rejected'; rejection_comment: string };

/** The fields a decision writes to the PR line. */
export interface DecisionFields {
  status: PrLineStatus;
  approved_quantity: number | null;
  rejection_comment: string | null;
}

/** Throws RuleViolation if an acceptance approves more than was requested. */
export function assertApprovedWithinRequested(decision: LineDecision, requested: number): void {
  if (decision.status === 'accepted' && decision.approved_quantity > requested) {
    throw new RuleViolation(`Approved quantity cannot exceed the requested quantity (${requested})`);
  }
}

/** The fields a decision writes. Each decision also clears the fields that do not belong to it. */
export function decisionFields(decision: LineDecision): DecisionFields {
  return decision.status === 'accepted'
    ? { status: 'accepted', approved_quantity: decision.approved_quantity, rejection_comment: null }
    : { status: 'rejected', approved_quantity: null, rejection_comment: decision.rejection_comment };
}
