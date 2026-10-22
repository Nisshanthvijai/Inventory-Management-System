import { z } from 'zod';
import { Row } from '../common/database.types';

/** What create_grn returns. */
export const grnCreatedSchema = z.looseObject({
  grn_id: z.string(),
  grn_no: z.string(),
  lines: z.number(),
});
export type GrnCreated = z.infer<typeof grnCreatedSchema>;

export type GrnListItem = Pick<
  Row<'goods_receipt'>,
  | 'id'
  | 'grn_no'
  | 'po_id'
  | 'received_date'
  | 'invoice_no'
  | 'invoice_date'
  | 'comments'
  | 'received_by'
  | 'created_at'
> & {
  received_by_name: string | null;
  lines: Pick<
    Row<'grn_line'>,
    'id' | 'po_line_id' | 'variant_id' | 'received_quantity' | 'completes_line'
  >[];
};
