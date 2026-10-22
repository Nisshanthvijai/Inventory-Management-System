/** Matches the pr_line_status_valid CHECK constraint in the database. */
export const PR_LINE_STATUSES = ['pending', 'accepted', 'rejected'] as const;

export type PrLineStatus = (typeof PR_LINE_STATUSES)[number];

/** True if the value is a known PR line status (e.g. a status read from the database). */
export function isPrLineStatus(value: unknown): value is PrLineStatus {
  return (PR_LINE_STATUSES as readonly unknown[]).includes(value);
}
