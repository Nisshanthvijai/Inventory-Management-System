import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
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

    if (error) throw new ApiError(500, error.message);
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
      if (error.code === '23514') throw new ApiError(400, error.message);
      if (error.code === '42501') throw new ApiError(403, 'Only an admin can change stock');
      throw new ApiError(500, error.message);
    }
    if (!data) throw new ApiError(404, 'Stock row not found');

    const { data: row, error: readError } = await db
      .from('v_stock')
      .select('*')
      .eq('stock_id', id)
      .maybeSingle();
    if (readError) throw new ApiError(500, readError.message);
    return row;
  }
}
