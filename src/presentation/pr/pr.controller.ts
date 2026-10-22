import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '../../application/common/session';
import { ApiZodBody } from '../common/api-zod-body';
import { CurrentSession } from '../common/current.decorators';
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
    @CurrentSession() session: Session,
    @Body(new ZodPipe(createPrSchema)) dto: CreatePrDto,
  ) {
    return this.pr.create(session, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List PRs: requestors see their own, managers and admins see all' })
  list(@CurrentSession() session: Session) {
    return this.pr.list(session);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One PR with its lines (404 if missing or not yours)' })
  get(@CurrentSession() session: Session, @Param('id', new UuidPipe()) id: string) {
    return this.pr.get(session, id);
  }
}
