import { Injectable } from '@nestjs/common';
import { Db, rpcArgs } from '../common/db';
import { AuthUser } from '../../domain/common/auth-user';
import { Conflict, NotAllowed, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { PermissionService } from '../common/permission.service';
import { parseRpcResult } from '../common/rpc-result';
import { CreateGrnDto } from './grn.dto';
import { GrnCreated, grnCreatedSchema, GrnListItem } from './grn.types';

@Injectable()
export class GrnService {
  constructor(private readonly permissions: PermissionService) {}

  async create(db: Db, user: AuthUser, dto: CreateGrnDto): Promise<GrnCreated> {
    // The database also requires a requestor to have a line on the PO.
    await this.permissions.require(db, user, 'grn.create');

    // Quantity limits, "already complete" and "PO must be open" are enforced by the database
    // (triggers and RLS) with clear messages; requestors cannot read PO tables to pre-check them.
    const { data, error } = await db.rpc(
      'create_grn',
      rpcArgs<'create_grn'>({
        p_po_id: dto.po_id,
        p_invoice_no: dto.invoice_no,
        p_lines: dto.lines,
        p_invoice_date: dto.invoice_date ?? null,
        p_received_date: dto.received_date ?? null,
        p_comments: dto.comments ?? null,
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

  async list(db: Db): Promise<GrnListItem[]> {
    // Read the tables, not v_grn_lines: that view joins PO tables a requestor cannot read.
    // RLS shows a requestor their own receipts and a manager or admin all of them.
    // One string literal (not joined pieces), so the typed client can read the columns.
    const { data, error } = await db
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
