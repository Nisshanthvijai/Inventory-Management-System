import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { NotFound } from '../../domain/common/errors';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { SetStockDto } from './stock.dto';
import { StockRepository } from './stock.repository';
import { StockRow } from './stock.types';

@Injectable()
export class StockService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly stock: StockRepository,
  ) {}

  list(session: Session): Promise<StockRow[]> {
    return this.stock.list(session);
  }

  /** Admin only. Sets the absolute quantity (e.g. after a stock count), then returns the row. */
  async setQuantity(session: Session, user: AuthUser, id: string, dto: SetStockDto): Promise<StockRow | null> {
    await this.permissions.require(session, user, 'stock.set');
    const found = await this.stock.setQuantity(session, id, dto.quantity);
    if (!found) throw new NotFound('Stock row not found');
    return this.stock.findById(session, id);
  }
}
