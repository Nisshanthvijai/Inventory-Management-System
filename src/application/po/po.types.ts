import { z } from 'zod';
import { Row } from '../common/database.types';

/** What create_po returns. */
export const poCreatedSchema = z.looseObject({
  po_id: z.string(),
  po_no: z.string(),
  lines: z.number(),
});
export type PoCreated = z.infer<typeof poCreatedSchema>;

export type PoSummary = Row<'v_purchase_order'>;

export type PoDetail = PoSummary & { lines: Row<'v_po_lines'>[] };
