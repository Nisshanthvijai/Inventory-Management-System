/** One stock row per variant, in the stock unit, with reorder flags (from v_stock). */
export interface StockRow {
  at_or_below_reorder: boolean | null;
  brand_name: string | null;
  item_name: string | null;
  quantity: number | null;
  quantity_text: string | null;
  reorder_level: number | null;
  stock_id: string | null;
  stock_unit: string | null;
  type_name: string | null;
  updated_at: string | null;
  updated_by: string | null;
  variant_code: string | null;
  variant_id: string | null;
}
