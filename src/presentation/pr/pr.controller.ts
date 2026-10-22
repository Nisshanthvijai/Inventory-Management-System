import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentDb } from '../common/current.decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { ZodPipe } from '../common/zod.pipe';
import { type CreatePrDto, createPrSchema } from '../../application/pr/pr.dto';
import { PrService } from '../../application/pr/pr.service';

@ApiTags('purchase requisitions')
@ApiBearerAuth()
@Controller('pr')
export class PrController {
  constructor(private readonly pr: PrService) {}

  @Post()
  @ApiOperation({ summary: 'Create a PR (requestor or admin). Quantities in the stock unit.' })
  @ApiZodBody(createPrSchema)
  create(
    @CurrentDb() db: SupabaseClient,
    @Body(new ZodPipe(createPrSchema)) dto: CreatePrDto,
  ) {
    return this.pr.create(db, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List PRs: requestors see their own, managers and admins see all' })
  list(@CurrentDb() db: SupabaseClient) {
    return this.pr.list(db);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One PR with its lines (404 if missing or not yours)' })
  get(@CurrentDb() db: SupabaseClient, @Param('id', new UuidPipe()) id: string) {
    return this.pr.get(db, id);
  }
}
