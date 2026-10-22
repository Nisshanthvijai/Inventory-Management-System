/** Matches the pr_line_status_valid CHECK constraint in the database. */
export const PR_LINE_STATUSES = ['pending', 'accepted', 'rejected'] as const;

export type PrLineStatus = (typeof PR_LINE_STATUSES)[number];
