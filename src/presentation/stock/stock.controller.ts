import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { type SetStockDto, setStockSchema } from '../../application/stock/stock.dto';
import { StockService } from '../../application/stock/stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Stock per variant, in the stock unit, with reorder flags' })
  list(@CurrentDb() db: SupabaseClient) {
    return this.stock.list(db);
  }

  /** `:id` is the stock_id from GET /stock. */
  @Patch(':id')
  @ApiOperation({ summary: 'Set the absolute quantity of a stock row (admin). :id is stock_id.' })
  @ApiZodBody(setStockSchema)
  setQuantity(
    @CurrentDb() db: SupabaseClient,
    @CurrentUser() user: AuthUser,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodPipe(setStockSchema)) dto: SetStockDto,
  ) {
    return this.stock.setQuantity(db, user, id, dto);
  }
}
