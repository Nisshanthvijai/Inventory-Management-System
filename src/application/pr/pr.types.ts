/** What creating a PR returns. */
export interface PrCreated {
  pr_id: string;
  pr_no: string;
  lines: number;
}

/** A PR header, with the requester's name. */
export interface PrSummary {
  id: string;
  pr_no: string;
  pr_date: string;
  priority: string;
  status: string;
  requested_by: string;
  created_at: string;
  requested_by_name: string | null;
}

/** One PR line with names, units and statuses (from v_pr_lines). */
export interface PrLineView {
  approved_quantity: number | null;
  approved_text: string | null;
  brand_name: string | null;
  created_at: string | null;
  item_name: string | null;
  line_status: string | null;
  pr_date: string | null;
  pr_id: string | null;
  pr_line_id: string | null;
  pr_no: string | null;
  pr_status: string | null;
  priority: string | null;
  quantity: number | null;
  rejection_comment: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_text: string | null;
  stock_unit: string | null;
  type_name: string | null;
  variant_code: string | null;
  variant_id: string | null;
}

export type PrDetail = PrSummary & { lines: PrLineView[] };
