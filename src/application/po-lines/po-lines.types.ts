/** One of the caller's PO lines, without prices (from get_my_po_lines). */
export interface MyPoLine {
  arrival_date: string;
  brand_name: string;
  can_receive: boolean;
  is_complete: boolean;
  item_name: string;
  ordered_quantity: number;
  po_date: string;
  po_id: string;
  po_line_id: string;
  po_no: string;
  po_status: string;
  pr_no: string;
  purchase_unit: string;
  received_other_variants: number;
  received_same_variant: number;
  type_name: string;
  variant_code: string;
  variant_id: string;
  vendor_name: string;
}
