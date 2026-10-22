import { PoStatus } from '../../domain/po/po-status';
import { PrLineStatus } from '../../domain/pr-lines/pr-line-status';

/** What creating a PO returns. */
export interface PoCreated {
  po_id: string;
  po_no: string;
  lines: number;
}

/** A PO header with totals (from v_purchase_order). */
export interface PoSummary {
  against_pr: string | null;
  comments: string | null;
  created_at: string | null;
  created_by: string | null;
  line_count: number | null;
  payment_terms: string | null;
  po_date: string | null;
  po_id: string | null;
  po_no: string | null;
  status: string | null;
  total_before_gst: number | null;
  total_with_gst: number | null;
  vendor_address: string | null;
  vendor_gst_no: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
}

/** One PO line with prices, units and received quantities (from v_po_lines). */
export interface PoLineView {
  arrival_date: string | null;
  brand_name: string | null;
  gst: number | null;
  in_stock_units_text: string | null;
  is_complete: boolean | null;
  item_name: string | null;
  line_total: number | null;
  line_total_with_gst: number | null;
  ordered_stock_units: number | null;
  ordered_text: string | null;
  po_id: string | null;
  po_line_id: string | null;
  po_no: string | null;
  po_status: string | null;
  pr_line_id: string | null;
  pr_no: string | null;
  price: number | null;
  price_text: string | null;
  purchase_unit: string | null;
  quantity: number | null;
  received_quantity: number | null;
  stock_unit: string | null;
  type_name: string | null;
  units_per_purchase: number | null;
  variant_code: string | null;
  variant_id: string | null;
  vendor_name: string | null;
}

export type PoDetail = PoSummary & { lines: PoLineView[] };

/** What cancelling needs to know about a PO. */
export interface PoForCancel {
  po_no: string;
  status: PoStatus;
}

/** A PR line being ordered. */
export interface OrderPrLine {
  id: string;
  status: PrLineStatus;
  approved_quantity: number | null; // stock unit
  variant_id: string;
}

/** The units of a variant being ordered. */
export interface OrderVariant {
  variant_id: string;
  code: string;
  stock_unit: string;
  purchase_unit: string;
  units_per_purchase: number | null;
}

/** Everything the PO rules need about the PR lines a new PO orders. */
export interface OrderContext {
  prLines: OrderPrLine[];
  variants: OrderVariant[];
  /** Stock units already on other, non-cancelled POs, per PR line id. */
  orderedStockByPrLine: Map<string, number>;
}
