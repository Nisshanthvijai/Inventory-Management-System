import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../../domain/common/api-error';

@Injectable()
export class PoLinesService {
  /**
   * The caller's own PO lines, with no prices. The RPC does the filtering
   * (PRs requested by the caller), so requestors never need access to PO tables.
   */
  async mine(db: SupabaseClient) {
    const { data, error } = await db.rpc('get_my_po_lines');
    if (error) throw new ApiError(500, error.message);
    return data ?? [];
  }
}
