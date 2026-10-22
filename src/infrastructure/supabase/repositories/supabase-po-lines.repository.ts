import { Injectable } from '@nestjs/common';
import { RpcResult } from '../database.types';
import { UnexpectedError } from '../../../application/common/errors';
import { Session } from '../../../application/common/session';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { MyPoLine } from '../../../application/po-lines/po-lines.types';
import { dbOf } from '../supabase-session';
import { assertExact, Exact } from './exact';

assertExact<Exact<MyPoLine, RpcResult<'get_my_po_lines'>[number]>>();

@Injectable()
export class SupabasePoLinesRepository implements PoLinesRepository {
  async mine(session: Session): Promise<MyPoLine[]> {
    // The RPC does the filtering, so requestors never need access to the PO tables (or prices).
    const { data, error } = await dbOf(session).rpc('get_my_po_lines');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }
}
