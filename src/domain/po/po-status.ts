/** Matches the po_status_valid CHECK constraint in the database. */
export const PO_STATUSES = ['open', 'partially_received', 'received', 'cancelled'] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

/** True if the value is a known PO status (e.g. a status read from the database). */
export function isPoStatus(value: unknown): value is PoStatus {
  return (PO_STATUSES as readonly unknown[]).includes(value);
}
