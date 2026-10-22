import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Db } from '../../application/common/db';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb, CurrentUser } from '../common/current.decorators';
import { ZodPipe } from '../common/zod.pipe';
import { type CreateGrnDto, createGrnSchema } from '../../application/grn/grn.dto';
import { GrnService } from '../../application/grn/grn.service';

@ApiTags('goods receipts')
@ApiBearerAuth()
@Controller('grn')
export class GrnController {
  constructor(private readonly grn: GrnService) {}

  @Post()
  @ApiOperation({
    summary:
      'Receive goods on an open PO (requestor with a line on it, or admin). Quantities in the purchase unit. Does not change stock.',
  })
  @ApiZodBody(createGrnSchema)
  create(
    @CurrentDb() db: Db,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createGrnSchema)) dto: CreateGrnDto,
  ) {
    return this.grn.create(db, user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List goods receipts with their lines (yours, or all for manager/admin)' })
  list(@CurrentDb() db: Db) {
    return this.grn.list(db);
  }
}
