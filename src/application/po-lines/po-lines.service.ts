import { Injectable } from '@nestjs/common';
import { RpcResult } from '../common/database.types';
import { UnexpectedError } from '../common/errors';
import { Session } from '../common/session';
import { dbOf } from '../../infrastructure/supabase/supabase-session'; // TEMP (phase 4)

@Injectable()
export class PoLinesService {
  /**
   * The caller's own PO lines, with no prices. The RPC does the filtering
   * (PRs requested by the caller), so requestors never need access to PO tables.
   */
  async mine(session: Session): Promise<RpcResult<'get_my_po_lines'>> {
    const db = dbOf(session); // TEMP (phase 4): removed when this feature gets its repository
    const { data, error } = await db.rpc('get_my_po_lines');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }
}
