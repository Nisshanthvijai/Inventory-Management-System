import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Row } from '../../../application/common/database.types';
import { rpcArgs } from '../../../application/common/db';
import { UnexpectedError } from '../../../application/common/errors';
import { parseRpcResult } from '../rpc-result';
import { Session } from '../../../application/common/session';
import { CreateGrnDto } from '../../../application/grn/grn.dto';
import { GrnRepository } from '../../../application/grn/grn.repository';
import { GrnCreated, GrnLine, GrnListItem } from '../../../application/grn/grn.types';
import { Conflict, NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

type ReceiptRow = Pick<
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
>;
type LineRow = Pick<
  Row<'grn_line'>,
  'id' | 'po_line_id' | 'variant_id' | 'received_quantity' | 'completes_line'
>;
assertExact<Exact<GrnLine, LineRow>>();
assertExact<Exact<GrnListItem, ReceiptRow & { received_by_name: string | null; lines: LineRow[] }>>();

/** What create_grn returns; looseObject keeps any extra fields it adds. */
const grnCreatedSchema: z.ZodType<GrnCreated> = z.looseObject({
  grn_id: z.string(),
  grn_no: z.string(),
  lines: z.number(),
});

@Injectable()
export class SupabaseGrnRepository implements GrnRepository {
  async create(session: Session, grn: CreateGrnDto): Promise<GrnCreated> {
    const { data, error } = await dbOf(session).rpc(
      'create_grn',
      rpcArgs<'create_grn'>({
        p_po_id: grn.po_id,
        p_invoice_no: grn.invoice_no,
        p_lines: grn.lines,
        p_invoice_date: grn.invoice_date ?? null,
        p_received_date: grn.received_date ?? null,
        p_comments: grn.comments ?? null,
      }),
    );
    if (error) {
      if (error.code === 'P0001' && error.message.includes('already complete')) {
        throw new Conflict(error.message);
      }
      if (error.code === 'P0001' || error.code === '23514') throw new RuleViolation(error.message);
      if (error.code === '42501') {
        throw new NotAllowed(
          'You cannot receive goods on this PO: it must be open or partially received (not fully received or cancelled), and a requestor needs one of their own lines on it',
        );
      }
      if (error.code === '23503') {
        throw new RuleViolation('The PO or a PO line does not exist, or a line does not belong to this PO');
      }
      if (error.code === '23505') throw new Conflict('This PO line is already on this GRN');
      throw new UnexpectedError(error.message);
    }
    return parseRpcResult(grnCreatedSchema, data, 'create_grn');
  }

  async list(session: Session): Promise<GrnListItem[]> {
    // Read the tables, not v_grn_lines: that view joins PO tables a requestor cannot read.
    // One string literal (not joined pieces), so the typed client can read the columns.
    const { data, error } = await dbOf(session)
      .from('goods_receipt')
      .select(
        'id, grn_no, po_id, received_date, invoice_no, invoice_date, comments, received_by, created_at, receiver:profile!goods_receipt_received_by_fkey(full_name), lines:grn_line(id, po_line_id, variant_id, received_quantity, completes_line)',
      )
      .order('created_at', { ascending: false });
    if (error) throw new UnexpectedError(error.message);

    return (data ?? []).map(({ receiver, ...grn }) => {
      const profile = Array.isArray(receiver) ? receiver[0] : receiver;
      return { ...grn, received_by_name: profile?.full_name ?? null };
    });
  }
}
