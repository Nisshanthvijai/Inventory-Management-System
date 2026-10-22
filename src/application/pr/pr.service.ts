import { Injectable } from '@nestjs/common';
import { Db } from '../common/db';
import { NotAllowed, NotFound, RuleViolation } from '../../domain/common/errors';
import { UnexpectedError } from '../common/errors';
import { CreatePrDto } from './pr.dto';

@Injectable()
export class PrService {
  async create(db: Db, dto: CreatePrDto) {
    const { data, error } = await db.rpc('create_pr', {
      p_lines: dto.lines,
      p_priority: dto.priority,
    });

    if (error) {
      // P0001: the RPC raised a rule message. 42501: RLS said no. 23503: unknown variant.
      if (error.code === 'P0001') throw new RuleViolation(error.message);
      if (error.code === '42501') throw new NotAllowed('You cannot create a PR');
      if (error.code === '23503') throw new RuleViolation('Unknown item variant');
      throw new UnexpectedError(error.message);
    }

    return data as { pr_id: string; pr_no: string; lines: number };
  }

  async list(db: Db) {
    const { data, error } = await db
      .from('purchase_requisition')
      .select(
        'id, pr_no, pr_date, priority, status, requested_by, created_at, requester:profile!purchase_requisition_requested_by_fkey(full_name)',
      )
      .order('created_at', { ascending: false });

    if (error) throw new UnexpectedError(error.message);

    return (data ?? []).map(({ requester, ...pr }) => {
      const profile = Array.isArray(requester) ? requester[0] : requester;
      return { ...pr, requested_by_name: profile?.full_name ?? null };
    });
  }

  async get(db: Db, id: string) {
    const { data: header, error } = await db
      .from('purchase_requisition')
      .select(
        'id, pr_no, pr_date, priority, status, requested_by, created_at, requester:profile!purchase_requisition_requested_by_fkey(full_name)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new UnexpectedError(error.message);
    // RLS hides PRs the caller may not see, so "not yours" looks the same as "not there".
    if (!header) throw new NotFound('PR not found');

    const { data: lines, error: linesError } = await db
      .from('v_pr_lines')
      .select('*')
      .eq('pr_id', id)
      .order('created_at')
      .order('item_name');

    if (linesError) throw new UnexpectedError(linesError.message);

    const { requester, ...pr } = header;
    const profile = Array.isArray(requester) ? requester[0] : requester;
    return { ...pr, requested_by_name: profile?.full_name ?? null, lines: lines ?? [] };
  }
}
  