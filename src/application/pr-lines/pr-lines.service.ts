import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { DecideLineDto } from './pr-lines.dto';

@Injectable()
export class PrLinesService {
  async decide(db: SupabaseClient, user: AuthUser, id: string, dto: DecideLineDto) {
    await this.requireManager(db, user);

    const { data: line, error: lineError } = await db
      .from('pr_line')
      .select('id, quantity')
      .eq('id', id)
      .maybeSingle();
    if (lineError) throw new ApiError(500, lineError.message);
    if (!line) throw new ApiError(404, 'PR line not found');

    const requested = Number(line.quantity);
    if (dto.status === 'accepted' && dto.approved_quantity > requested) {
      throw new ApiError(
        400,
        `Approved quantity cannot exceed the requested quantity (${requested})`,
      );
    }

    // Each decision also clears the fields that do not belong to it.
    const patch =
      dto.status === 'accepted'
        ? { status: 'accepted', approved_quantity: dto.approved_quantity, rejection_comment: null }
        : { status: 'rejected', approved_quantity: null, rejection_comment: dto.rejection_comment };

    const { data: updated, error } = await db
      .from('pr_line')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === 'P0001' && error.message.includes('already on a PO')) {
        throw new ApiError(409, 'This line is already on a PO and can no longer be changed');
      }
      if (error.code === 'P0001' || error.code === '23514') throw new ApiError(400, error.message);
      if (error.code === '42501') throw new ApiError(403, 'You cannot decide on this line');
      throw new ApiError(500, error.message);
    }
    if (!updated) throw new ApiError(403, 'You cannot decide on this line');

    // Re-read from the view: it carries the line's new status and the PR's recalculated status.
    const { data: result, error: readError } = await db
      .from('v_pr_lines')
      .select('*')
      .eq('pr_line_id', id)
      .maybeSingle();
    if (readError) throw new ApiError(500, readError.message);
    return result;
  }

  private async requireManager(db: SupabaseClient, user: AuthUser) {
    const { data, error } = await db
      .from('profile')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    if (data?.role !== 'manager' && data?.role !== 'admin') {
      throw new ApiError(403, 'Only a manager or admin can decide on a PR line');
    }
  }
}
