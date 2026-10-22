import { Injectable } from '@nestjs/common';
import { Row } from '../common/database.types';
import { AuthUser } from '../../domain/common/auth-user';
import { NotAllowed, NotFound, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { PermissionService } from '../common/permission.service';
import { SetStockDto } from './stock.dto';
import { Session } from '../common/session';
import { dbOf } from '../../infrastructure/supabase/supabase-session'; // TEMP (phase 4)

@Injectable()
export class StockService {
  constructor(private readonly permissions: PermissionService) {}

  async list(session: Session): Promise<Row<'v_stock'>[]> {
    const db = dbOf(session); // TEMP (phase 4): removed when this feature gets its repository
    const { data, error } = await db
      .from('v_stock')
      .select('*')
      .order('item_name')
      .order('variant_code');

    if (error) throw new UnexpectedError(error.message);
    return data;
  }

  /** Admin only. One UPDATE sets the new total, so concurrent admins cannot lose each other's change. */
  async setQuantity(session: Session, user: AuthUser, id: string, dto: SetStockDto): Promise<Row<'v_stock'> | null> {
    const db = dbOf(session); // TEMP (phase 4): removed when this feature gets its repository
    await this.permissions.require(session, user, 'stock.set');

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
