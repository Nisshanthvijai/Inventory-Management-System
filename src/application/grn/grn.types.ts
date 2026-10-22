/** What creating a GRN returns. */
export interface GrnCreated {
  grn_id: string;
  grn_no: string;
  lines: number;
}

/** One received line on a GRN. */
export interface GrnLine {
  id: string;
  po_line_id: string;
  variant_id: string;
  received_quantity: number;
  completes_line: boolean;
}

/** A goods receipt with its lines and the receiver's name. */
export interface GrnListItem {
  id: string;
  grn_no: string;
  po_id: string;
  received_date: string;
  invoice_no: string;
  invoice_date: string | null;
  comments: string | null;
  received_by: string;
  created_at: string;
  received_by_name: string | null;
  lines: GrnLine[];
}
