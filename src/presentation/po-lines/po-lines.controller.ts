import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session } from '../../application/common/session';
import { CurrentSession } from '../common/current.decorators';
import { PoLinesService } from '../../application/po-lines/po-lines.service';

@ApiTags('purchase orders')
@ApiBearerAuth()
@Controller('po-lines')
export class PoLinesController {
  constructor(private readonly poLines: PoLinesService) {}

  @Get('mine')
  @ApiOperation({ summary: 'PO lines for PRs you requested, without prices (any user)' })
  mine(@CurrentSession() session: Session) {
    return this.poLines.mine(session);
  }
}
