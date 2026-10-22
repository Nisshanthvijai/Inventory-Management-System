import { Injectable } from '@nestjs/common';
import { RpcResult } from '../common/database.types';
import { Db } from '../common/db';
import { UnexpectedError } from '../common/errors';

@Injectable()
export class PoLinesService {
  /**
   * The caller's own PO lines, with no prices. The RPC does the filtering
   * (PRs requested by the caller), so requestors never need access to PO tables.
   */
  async mine(db: Db): Promise<RpcResult<'get_my_po_lines'>> {
    const { data, error } = await db.rpc('get_my_po_lines');
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }
}
