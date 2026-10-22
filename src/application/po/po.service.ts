import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { assertPoLineAllowed } from '../../domain/po/po-line-rules';
import { requireManager } from '../common/roles';
import { CreatePoDto } from './po.dto';

@Injectable()
export class PoService {
  async list(db: SupabaseClient, user: AuthUser) {
    // RLS alone would give a requestor an empty list; a clear 403 says why.
    await requireManager(db, user, 'view POs; requestors should use GET /po-lines/mine');

    const { data, error } = await db
      .from('v_purchase_order')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    return data;
  }

  async get(db: SupabaseClient, user: AuthUser, id: string) {
    await requireManager(db, user, 'view POs; requestors should use GET /po-lines/mine');

    const { data: header, error } = await db
      .from('v_purchase_order')
      .select('*')
      .eq('po_id', id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    if (!header) throw new ApiError(404, 'PO not found');

    const { data: lines, error: linesError } = await db
      .from('v_po_lines')
      .select('*')
      .eq('po_id', id)
      .order('item_name')
      .order('variant_code');
    if (linesError) throw new ApiError(500, linesError.message);

    return { ...header, lines: lines ?? [] };
  }

  async cancel(db: SupabaseClient, user: AuthUser, id: string) {
    await requireManager(db, user, 'cancel a PO');

    const { data: po, error } = await db
      .from('purchase_order')
      .select('id, po_no, status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    if (!po) throw new ApiError(404, 'PO not found');
    if (po.status !== 'open') {
      throw new ApiError(409, `PO ${po.po_no} is ${po.status}; only an open PO can be cancelled`);
    }

    // `.eq('status', 'open')` makes this safe if the PO changed since we read it.
    const { data: cancelled, error: updateError } = await db
      .from('purchase_order')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'open')
      .select('id')
      .maybeSingle();

    if (updateError) {
      if (updateError.code === 'P0001' && updateError.message.includes('goods received')) {
        throw new ApiError(409, 'This PO already has goods received and cannot be cancelled');
      }
      if (updateError.code === 'P0001') throw new ApiError(409, updateError.message);
      if (updateError.code === '42501') throw new ApiError(403, 'You cannot cancel this PO');
      throw new ApiError(500, updateError.message);
    }
    if (!cancelled) throw new ApiError(409, 'The PO changed while cancelling; reload it and try again');

    const { data: result, error: readError } = await db
      .from('v_purchase_order')
      .select('*')
      .eq('po_id', id)
      .maybeSingle();
    if (readError) throw new ApiError(500, readError.message);
    return result;
  }

  async create(db: SupabaseClient, user: AuthUser, dto: CreatePoDto) {
    await requireManager(db, user, 'create a PO');

    const prLineIds = dto.lines.map((l) => l.pr_line_id);

    // 1. The PR lines being ordered.
    const { data: prLines, error: prError } = await db
      .from('pr_line')
      .select('id, status, approved_quantity, variant_id')
      .in('id', prLineIds);
    if (prError) throw new ApiError(500, prError.message);

    // 2. Units for the variants (PO lines use the PR line's own variant: no substitutes).
    const variantIds = [...new Set((prLines ?? []).map((l) => l.variant_id))];
    const { data: variants, error: variantError } = await db
      .from('v_variants')
      .select('variant_id, code, stock_unit, purchase_unit, units_per_purchase')
      .in('variant_id', variantIds);
    if (variantError) throw new ApiError(500, variantError.message);

    // 3. How much of each PR line is already on other POs (cancelled POs do not count).
    const { data: ordered, error: orderedError } = await db
      .from('v_po_lines')
      .select('pr_line_id, ordered_stock_units')
      .in('pr_line_id', prLineIds)
      .neq('po_status', 'cancelled');
    if (orderedError) throw new ApiError(500, orderedError.message);

    const orderedStock = new Map<string, number>();
    for (const o of ordered ?? []) {
      orderedStock.set(o.pr_line_id, (orderedStock.get(o.pr_line_id) ?? 0) + Number(o.ordered_stock_units));
    }

    for (const line of dto.lines) {
      const pr = (prLines ?? []).find((p) => p.id === line.pr_line_id);
      if (!pr) throw new ApiError(404, `PR line not found: ${line.pr_line_id}`);

      const variant = (variants ?? []).find((v) => v.variant_id === pr.variant_id);
      if (!variant) throw new ApiError(404, `Item variant not found for PR line ${line.pr_line_id}`);

      assertPoLineAllowed({
        name: variant.code,
        prStatus: pr.status,
        approved: Number(pr.approved_quantity),
        unitsPerPurchase: Number(variant.units_per_purchase),
        stockUnit: variant.stock_unit,
        purchaseUnit: variant.purchase_unit,
        alreadyOrderedStock: orderedStock.get(line.pr_line_id) ?? 0,
        quantity: line.quantity,
      });
    }

    const { data, error } = await db.rpc('create_po', {
      p_vendor_id: dto.vendor_id,
      p_lines: dto.lines,
      p_payment_terms: dto.payment_terms ?? null,
      p_comments: dto.comments ?? null,
      p_po_date: dto.po_date ?? null,
    });

    if (error) {
      if (error.code === 'P0001' && error.message.includes('Vendor not found')) {
        throw new ApiError(404, 'Vendor not found');
      }
      if (error.code === 'P0001') throw new ApiError(400, error.message);
      if (error.code === '23505') throw new ApiError(409, 'This PR line is already on this PO');
      if (error.code === '23503') throw new ApiError(400, 'A referenced record does not exist');
      if (error.code === '42501') throw new ApiError(403, 'You cannot create a PO');
      throw new ApiError(500, error.message);
    }

    return data as { po_id: string; po_no: string; lines: number };
  }
}
