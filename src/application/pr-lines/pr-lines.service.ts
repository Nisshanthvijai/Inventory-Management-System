import { Injectable } from '@nestjs/common';
import { Row } from '../common/database.types';
import { AuthUser } from '../../domain/common/auth-user';
import { Conflict, NotAllowed, NotFound, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { assertApprovedWithinRequested, decisionFields } from '../../domain/pr-lines/pr-line-rules';
import { PermissionService } from '../common/permission.service';
import { DecideLineDto } from './pr-lines.dto';
import { Session } from '../common/session';
import { dbOf } from '../../infrastructure/supabase/supabase-session'; // TEMP (phase 4)

@Injectable()
export class PrLinesService {
  constructor(private readonly permissions: PermissionService) {}

  async decide(session: Session, user: AuthUser, id: string, dto: DecideLineDto): Promise<Row<'v_pr_lines'> | null> {
    const db = dbOf(session); // TEMP (phase 4): removed when this feature gets its repository
    await this.permissions.require(session, user, 'pr-line.decide');

    const { data: line, error: lineError } = await db
      .from('pr_line')
      .select('id, quantity')
      .eq('id', id)
      .maybeSingle();
    if (lineError) throw new UnexpectedError(lineError.message);
    if (!line) throw new NotFound('PR line not found');

    assertApprovedWithinRequested(dto, Number(line.quantity));

    const { data: updated, error } = await db
      .from('pr_line')
      .update(decisionFields(dto))
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === 'P0001' && error.message.includes('already on a PO')) {
        throw new Conflict('This line is already on a PO and can no longer be changed');
      }
      if (error.code === 'P0001' || error.code === '23514') throw new RuleViolation(error.message);
      if (error.code === '42501') throw new NotAllowed('You cannot decide on this line');
      throw new UnexpectedError(error.message);
    }
    if (!updated) throw new NotAllowed('You cannot decide on this line');

    // Re-read from the view: it carries the line's new status and the PR's recalculated status.
    const { data: result, error: readError } = await db
      .from('v_pr_lines')
      .select('*')
      .eq('pr_line_id', id)
      .maybeSingle();
    if (readError) throw new UnexpectedError(readError.message);
    return result;
  }
}
