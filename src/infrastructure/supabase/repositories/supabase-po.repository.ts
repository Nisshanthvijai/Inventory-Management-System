import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Row } from '../database.types';
import { rpcArgs } from '../db';
import { UnexpectedError } from '../../../application/common/errors';
import { parseRpcResult } from '../rpc-result';
import { Session } from '../../../application/common/session';
import { CreatePoDto } from '../../../application/po/po.dto';
import { PoRepository } from '../../../application/po/po.repository';
import {
  OrderContext,
  OrderVariant,
  PoCreated,
  PoForCancel,
  PoLineView,
  PoSummary,
} from '../../../application/po/po.types';
import { Conflict, NotAllowed, NotFound, RuleViolation } from '../../../domain/common/errors';
import { isPoStatus, PoStatus } from '../../../domain/po/po-status';
import { isPrLineStatus } from '../../../domain/pr-lines/pr-line-status';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

assertExact<Exact<PoSummary, Row<'v_purchase_order'>>>();
assertExact<Exact<PoLineView, Row<'v_po_lines'>>>();

/** What create_po returns; looseObject keeps any extra fields it adds. */
const poCreatedSchema: z.ZodType<PoCreated> = z.looseObject({
  po_id: z.string(),
  po_no: z.string(),
  lines: z.number(),
});

@Injectable()
export class SupabasePoRepository implements PoRepository {
  async list(session: Session): Promise<PoSummary[]> {
    const { data, error } = await dbOf(session)
      .from('v_purchase_order')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  async findSummary(session: Session, id: string): Promise<PoSummary | null> {
    const { data, error } = await dbOf(session)
      .from('v_purchase_order')
      .select('*')
      .eq('po_id', id)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  async findLines(session: Session, poId: string): Promise<PoLineView[]> {
    const { data, error } = await dbOf(session)
      .from('v_po_lines')
      .select('*')
      .eq('po_id', poId)
      .order('item_name')
      .order('variant_code');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }

  async findForCancel(session: Session, id: string): Promise<PoForCancel | null> {
    const { data, error } = await dbOf(session)
      .from('purchase_order')
      .select('id, po_no, status')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    if (!data) return null;
    if (!isPoStatus(data.status)) throw new UnexpectedError(`Unknown PO status: ${data.status}`);
    return { po_no: data.po_no, status: data.status };
  }

  async cancelIfOpen(session: Session, id: string): Promise<boolean> {
    // `.eq('status', 'open')` makes this safe if the PO changed since it was read.
    const { data, error } = await dbOf(session)
      .from('purchase_order')
      .update({ status: 'cancelled' satisfies PoStatus })
      .eq('id', id)
      .eq('status', 'open' satisfies PoStatus)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === 'P0001' && error.message.includes('goods received')) {
        throw new Conflict('This PO already has goods received and cannot be cancelled');
      }
      if (error.code === 'P0001') throw new Conflict(error.message);
      if (error.code === '42501') throw new NotAllowed('You cannot cancel this PO');
      throw new UnexpectedError(error.message);
    }
    return data !== null;
  }

  async loadOrderContext(session: Session, prLineIds: string[]): Promise<OrderContext> {
    const db = dbOf(session);

    // 1. The PR lines being ordered.
    const { data: prRows, error: prError } = await db
      .from('pr_line')
      .select('id, status, approved_quantity, variant_id')
      .in('id', prLineIds);
    if (prError) throw new UnexpectedError(prError.message);

    // 2. Units for their variants (PO lines use the PR line's own variant: no substitutes).
    const variantIds = [...new Set((prRows ?? []).map((l) => l.variant_id))];
    const { data: variantRows, error: variantError } = await db
      .from('v_variants')
      .select('variant_id, code, stock_unit, purchase_unit, units_per_purchase')
      .in('variant_id', variantIds);
    if (variantError) throw new UnexpectedError(variantError.message);

    // 3. How much of each PR line is already on other POs (cancelled POs do not count).
    const { data: orderedRows, error: orderedError } = await db
      .from('v_po_lines')
      .select('pr_line_id, ordered_stock_units')
      .in('pr_line_id', prLineIds)
      .neq('po_status', 'cancelled' satisfies PoStatus);
    if (orderedError) throw new UnexpectedError(orderedError.message);

    const prLines = (prRows ?? []).map((l) => {
      if (!isPrLineStatus(l.status)) throw new UnexpectedError(`Unknown PR line status: ${l.status}`);
      return { ...l, status: l.status };
    });

    // v_variants is a view, so every column is typed nullable; these are never null in the data.
    const variants = (variantRows ?? []).map((v): OrderVariant => {
      const { variant_id, code, stock_unit, purchase_unit, units_per_purchase } = v;
      if (variant_id === null || code === null || stock_unit === null || purchase_unit === null) {
        throw new UnexpectedError(`Item variant ${variant_id} is missing its code or units`);
      }
      return { variant_id, code, stock_unit, purchase_unit, units_per_purchase };
    });

    const orderedStockByPrLine = new Map<string, number>();
    for (const o of orderedRows ?? []) {
      if (o.pr_line_id === null) continue; // a view column, so typed nullable; never null here
      const sum = (orderedStockByPrLine.get(o.pr_line_id) ?? 0) + Number(o.ordered_stock_units);
      orderedStockByPrLine.set(o.pr_line_id, sum);
    }

    return { prLines, variants, orderedStockByPrLine };
  }

  async create(session: Session, po: CreatePoDto): Promise<PoCreated> {
    const { data, error } = await dbOf(session).rpc(
      'create_po',
      rpcArgs<'create_po'>({
        p_vendor_id: po.vendor_id,
        p_lines: po.lines,
        p_payment_terms: po.payment_terms ?? null,
        p_comments: po.comments ?? null,
        p_po_date: po.po_date ?? null,
      }),
    );
    if (error) {
      if (error.code === 'P0001' && error.message.includes('Vendor not found')) {
        throw new NotFound('Vendor not found');
      }
      if (error.code === 'P0001') throw new RuleViolation(error.message);
      if (error.code === '23505') throw new Conflict('This PR line is already on this PO');
      if (error.code === '23503') throw new RuleViolation('A referenced record does not exist');
      if (error.code === '42501') throw new NotAllowed('You cannot create a PO');
      throw new UnexpectedError(error.message);
    }
    return parseRpcResult(poCreatedSchema, data, 'create_po');
  }
}
