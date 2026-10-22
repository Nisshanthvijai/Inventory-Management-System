import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../domain/common/auth-user';
import { NotAllowed, NotFound } from '../../domain/common/errors';
import { assertApprovedWithinRequested, decisionFields } from '../../domain/pr-lines/pr-line-rules';
import { PermissionService } from '../common/permission.service';
import { Session } from '../common/session';
import { PrLineView } from '../pr/pr.types';
import { DecideLineDto } from './pr-lines.dto';
import { PrLinesRepository } from './pr-lines.repository';

@Injectable()
export class PrLinesService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly prLines: PrLinesRepository,
  ) {}

  async decide(session: Session, user: AuthUser, id: string, dto: DecideLineDto): Promise<PrLineView | null> {
    await this.permissions.require(session, user, 'pr-line.decide');

    const requested = await this.prLines.findRequestedQuantity(session, id);
    if (requested === null) throw new NotFound('PR line not found');

    assertApprovedWithinRequested(dto, requested);

    const updated = await this.prLines.saveDecision(session, id, decisionFields(dto));
    if (!updated) throw new NotAllowed('You cannot decide on this line');

    // Re-read: the view carries the line's new status and the PR's recalculated status.
    return this.prLines.findLine(session, id);
  }
}
