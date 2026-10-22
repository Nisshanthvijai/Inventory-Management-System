import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Row } from '../../../application/common/database.types';
import { UnexpectedError } from '../../../application/common/errors';
import { parseRpcResult } from '../../../application/common/rpc-result';
import { Session } from '../../../application/common/session';
import { CreatePrDto } from '../../../application/pr/pr.dto';
import { PrRepository } from '../../../application/pr/pr.repository';
import { PrCreated, PrLineView, PrSummary } from '../../../application/pr/pr.types';
import { NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

type PrHeader = Pick<
  Row<'purchase_requisition'>,
  'id' | 'pr_no' | 'pr_date' | 'priority' | 'status' | 'requested_by' | 'created_at'
>;
assertExact<Exact<PrSummary, PrHeader & { requested_by_name: string | null }>>();
assertExact<Exact<PrLineView, Row<'v_pr_lines'>>>();

/** What create_pr returns; looseObject keeps any extra fields it adds. */
const prCreatedSchema: z.ZodType<PrCreated> = z.looseObject({
  pr_id: z.string(),
  pr_no: z.string(),
  lines: z.number(),
});

const HEADER =
  'id, pr_no, pr_date, priority, status, requested_by, created_at, requester:profile!purchase_requisition_requested_by_fkey(full_name)';

/** The joined requester comes back as an object (or a one-item array); keep just the name. */
function withRequesterName<T extends { requester: { full_name: string } | { full_name: string }[] | null }>(
  row: T,
): Omit<T, 'requester'> & { requested_by_name: string | null } {
  const { requester, ...pr } = row;
  const profile = Array.isArray(requester) ? requester[0] : requester;
  return { ...pr, requested_by_name: profile?.full_name ?? null };
}

@Injectable()
export class SupabasePrRepository implements PrRepository {
  async create(session: Session, pr: CreatePrDto): Promise<PrCreated> {
    const { data, error } = await dbOf(session).rpc('create_pr', {
      p_lines: pr.lines,
      p_priority: pr.priority,
    });
    if (error) {
      // P0001: the RPC raised a rule message. 42501: RLS said no. 23503: unknown variant.
      if (error.code === 'P0001') throw new RuleViolation(error.message);
      if (error.code === '42501') throw new NotAllowed('You cannot create a PR');
      if (error.code === '23503') throw new RuleViolation('Unknown item variant');
      throw new UnexpectedError(error.message);
    }
    return parseRpcResult(prCreatedSchema, data, 'create_pr');
  }

  async list(session: Session): Promise<PrSummary[]> {
    const { data, error } = await dbOf(session)
      .from('purchase_requisition')
      .select(HEADER)
      .order('created_at', { ascending: false });
    if (error) throw new UnexpectedError(error.message);
    return (data ?? []).map(withRequesterName);
  }

  async findById(session: Session, id: string): Promise<PrSummary | null> {
    const { data, error } = await dbOf(session)
      .from('purchase_requisition')
      .select(HEADER)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new UnexpectedError(error.message);
    return data && withRequesterName(data);
  }

  async findLines(session: Session, prId: string): Promise<PrLineView[]> {
    const { data, error } = await dbOf(session)
      .from('v_pr_lines')
      .select('*')
      .eq('pr_id', prId)
      .order('created_at')
      .order('item_name');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }
}
