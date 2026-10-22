import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { NotAllowed, NotFound, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { requireAdmin } from '../common/roles';
import { SetStockDto } from './stock.dto';

@Injectable()
export class StockService {
  async list(db: SupabaseClient) {
    const { data, error } = await db
      .from('v_stock')
      .select('*')
      .order('item_name')
      .order('variant_code');

    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  /** Admin only. One UPDATE sets the new total, so concurrent admins cannot lose each other's change. */
  async setQuantity(db: SupabaseClient, user: AuthUser, id: string, dto: SetStockDto) {
    await requireAdmin(db, user, 'change stock');

    const { data, error } = await db
      .from('stock')
      .update({ quantity: dto.quantity })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23514') throw new RuleViolation(error.message);
      if (error.code === '42501') throw new NotAllowed('Only an admin can change stock');
      throw new UnexpectedError(error.message);
    }
    if (!data) throw new NotFound('Stock row not found');

    const { data: row, error: readError } = await db
      .from('v_stock')
      .select('*')
      .eq('stock_id', id)
      .maybeSingle();
    if (readError) throw new UnexpectedError(readError.message);
    return row;
  }
}
