import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { type CreatePoDto, createPoSchema } from '../../application/po/po.dto';
import { PoService } from '../../application/po/po.service';

@ApiTags('purchase orders')
@ApiBearerAuth()
@Controller('po')
export class PoController {
  constructor(private readonly po: PoService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a PO (manager/admin). Quantities in the purchase unit; at most ceil(approved / units_per_purchase) per PR line, whole packs only.',
  })
  @ApiZodBody(createPoSchema)
  create(
    @CurrentDb() db: SupabaseClient,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createPoSchema)) dto: CreatePoDto,
  ) {
    return this.po.create(db, user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List POs with totals (manager/admin; requestors use /po-lines/mine)' })
  list(@CurrentDb() db: SupabaseClient, @CurrentUser() user: AuthUser) {
    return this.po.list(db, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One PO with its lines, prices and received quantities (manager/admin)' })
  get(
    @CurrentDb() db: SupabaseClient,
    @CurrentUser() user: AuthUser,
    @Param('id', new UuidPipe()) id: string,
  ) {
    return this.po.get(db, user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an open PO (manager/admin); 409 if not open or goods were received' })
  cancel(
    @CurrentDb() db: SupabaseClient,
    @CurrentUser() user: AuthUser,
    @Param('id', new UuidPipe()) id: string,
  ) {
    return this.po.cancel(db, user, id);
  }
}
