/** Matches the po_status_valid CHECK constraint in the database. */
export const PO_STATUSES = ['open', 'partially_received', 'received', 'cancelled'] as const;

export type PoStatus = (typeof PO_STATUSES)[number];
