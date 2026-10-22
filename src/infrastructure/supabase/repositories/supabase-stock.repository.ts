import { Injectable } from '@nestjs/common';
import { Row } from '../../../application/common/database.types';
import { UnexpectedError } from '../../../application/common/errors';
import { Session } from '../../../application/common/session';
import { StockRepository } from '../../../application/stock/stock.repository';
import { StockRow } from '../../../application/stock/stock.types';
import { NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

assertExact<Exact<StockRow, Row<'v_stock'>>>();

@Injectable()
export class SupabaseStockRepository implements StockRepository {
  async list(session: Session): Promise<StockRow[]> {
    const { data, error } = await dbOf(session)
      .from('v_stock')
      .select('*')
      .order('item_name')
      .order('variant_code');
    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  async findById(session: Session, stockId: string): Promise<StockRow | null> {
    const { data, error } = await dbOf(session)
      .from('v_stock')
      .select('*')
      .eq('stock_id', stockId)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  async setQuantity(session: Session, stockId: string, quantity: number): Promise<boolean> {
    const { data, error } = await dbOf(session)
      .from('stock')
      .update({ quantity })
      .eq('id', stockId)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23514') throw new RuleViolation(error.message);
      if (error.code === '42501') throw new NotAllowed('Only an admin can change stock');
      throw new UnexpectedError(error.message);
    }
    return data !== null;
  }
}
