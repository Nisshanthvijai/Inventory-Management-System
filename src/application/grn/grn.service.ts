import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { assertCanReceiveGoods } from '../../domain/grn/grn-rules';
import { CreateGrnDto } from './grn.dto';

@Injectable()
export class GrnService {
  async create(db: SupabaseClient, user: AuthUser, dto: CreateGrnDto) {
    await this.requireReceiver(db, user);

    // Quantity limits, "already complete" and "PO must be open" are enforced by the database
    // (triggers and RLS) with clear messages; requestors cannot read PO tables to pre-check them.
    const { data, error } = await db.rpc('create_grn', {
      p_po_id: dto.po_id,
      p_invoice_no: dto.invoice_no,
      p_lines: dto.lines,
      p_invoice_date: dto.invoice_date ?? null,
      p_received_date: dto.received_date ?? null,
      p_comments: dto.comments ?? null,
    });

    if (error) {
      if (error.code === 'P0001' && error.message.includes('already complete')) {
        throw new ApiError(409, error.message);
      }
      if (error.code === 'P0001' || error.code === '23514') throw new ApiError(400, error.message);
      if (error.code === '42501') {
        throw new ApiError(
          403,
          'You cannot receive goods on this PO: it must be open or partially received (not fully received or cancelled), and a requestor needs one of their own lines on it',
        );
      }
      if (error.code === '23503') {
        throw new ApiError(400, 'The PO or a PO line does not exist, or a line does not belong to this PO');
      }
      if (error.code === '23505') throw new ApiError(409, 'This PO line is already on this GRN');
      throw new ApiError(500, error.message);
    }

    return data as { grn_id: string; grn_no: string; lines: number };
  }

  async list(db: SupabaseClient) {
    // Read the tables, not v_grn_lines: that view joins PO tables a requestor cannot read.
    // RLS shows a requestor their own receipts and a manager or admin all of them.
    const { data, error } = await db
      .from('goods_receipt')
      .select(
        'id, grn_no, po_id, received_date, invoice_no, invoice_date, comments, received_by, created_at, ' +
          'receiver:profile!goods_receipt_received_by_fkey(full_name), ' +
          'lines:grn_line(id, po_line_id, variant_id, received_quantity, completes_line)',
      )
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);

    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
      ({ receiver, ...grn }) => {
        const profile = (Array.isArray(receiver) ? receiver[0] : receiver) as
          | { full_name: string }
          | null
          | undefined;
        return { ...grn, received_by_name: profile?.full_name ?? null };
      },
    );
  }

  /** The database allows an admin, or a requestor with a line on the PO. Managers are refused. */
  private async requireReceiver(db: SupabaseClient, user: AuthUser) {
    const { data, error } = await db
      .from('profile')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    assertCanReceiveGoods(data?.role);
  }
}
