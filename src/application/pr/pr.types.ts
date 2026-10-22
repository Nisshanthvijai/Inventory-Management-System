import { z } from 'zod';
import { Row } from '../common/database.types';

/** What create_pr returns. */
export const prCreatedSchema = z.looseObject({
  pr_id: z.string(),
  pr_no: z.string(),
  lines: z.number(),
});
export type PrCreated = z.infer<typeof prCreatedSchema>;

export type PrSummary = Pick<
  Row<'purchase_requisition'>,
  'id' | 'pr_no' | 'pr_date' | 'priority' | 'status' | 'requested_by' | 'created_at'
> & { requested_by_name: string | null };

export type PrDetail = PrSummary & { lines: Row<'v_pr_lines'>[] };
