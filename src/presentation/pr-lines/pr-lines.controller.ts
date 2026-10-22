import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb, CurrentUser } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { type DecideLineDto, decideLineSchema } from '../../application/pr-lines/pr-lines.dto';
import { PrLinesService } from '../../application/pr-lines/pr-lines.service';

@ApiTags('purchase requisitions')
@ApiBearerAuth()
@Controller('pr-lines')
export class PrLinesController {
  constructor(private readonly prLines: PrLinesService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Manager/admin decision on a PR line: accept with a quantity, or reject with a comment',
  })
  @ApiZodBody(decideLineSchema)
  decide(
    @CurrentDb() db: SupabaseClient,
    @CurrentUser() user: AuthUser,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodPipe(decideLineSchema)) dto: DecideLineDto,
  ) {
    return this.prLines.decide(db, user, id, dto);
  }
}
