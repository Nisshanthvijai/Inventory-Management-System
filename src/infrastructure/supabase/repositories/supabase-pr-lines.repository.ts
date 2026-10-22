import { Injectable } from '@nestjs/common';
import { UnexpectedError } from '../../../application/common/errors';
import { Session } from '../../../application/common/session';
import { PrLinesRepository } from '../../../application/pr-lines/pr-lines.repository';
import { PrLineView } from '../../../application/pr/pr.types';
import { Conflict, NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { DecisionFields } from '../../../domain/pr-lines/pr-line-rules';
import { dbOf } from '../supabase-session';

@Injectable()
export class SupabasePrLinesRepository implements PrLinesRepository {
  async findRequestedQuantity(session: Session, id: string): Promise<number | null> {
    const { data, error } = await dbOf(session)
      .from('pr_line')
      .select('id, quantity')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data ? Number(data.quantity) : null;
  }

  async saveDecision(session: Session, id: string, fields: DecisionFields): Promise<boolean> {
    const { data, error } = await dbOf(session)
      .from('pr_line')
      .update(fields)
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
    return data !== null;
  }

  async findLine(session: Session, id: string): Promise<PrLineView | null> {
    const { data, error } = await dbOf(session)
      .from('v_pr_lines')
      .select('*')
      .eq('pr_line_id', id)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data;
  }
}
