import { Injectable } from '@nestjs/common';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from '../../domain/common/auth-user';
import { ApiError } from '../../domain/common/api-error';
import { requireAdmin, requireManager } from '../common/roles';
import { MasterResource } from './master.resources';

@Injectable()
export class MasterService {
  async list(db: SupabaseClient, user: AuthUser, r: MasterResource) {
    if (r.readRole === 'manager') await requireManager(db, user, `view ${r.label}s`);

    let query = db.from(r.listFrom ?? r.table).select(r.listSelect ?? r.select);
    for (const column of r.order) query = query.order(column);
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return data ?? [];
  }

  async create(db: SupabaseClient, user: AuthUser, r: MasterResource, dto: object) {
    await requireAdmin(db, user, `create or change ${r.label}s`);
    const { data, error } = await db.from(r.table).insert(dto).select(r.select).single();
    if (error) throw this.writeError(error, r);
    return data;
  }

  async update(db: SupabaseClient, user: AuthUser, r: MasterResource, id: string, dto: object) {
    await requireAdmin(db, user, `create or change ${r.label}s`);
    const { data, error } = await db
      .from(r.table)
      .update(dto)
      .eq('id', id)
      .select(r.select)
      .maybeSingle();
    if (error) throw this.writeError(error, r);
    if (!data) throw new ApiError(404, `${capitalise(r.label)} not found`);
    return data;
  }

  private writeError(error: PostgrestError, r: MasterResource) {
    switch (error.code) {
      case '23505': // unique
        return new ApiError(409, `A ${r.label} with these values already exists`);
      case '23503': // foreign key
        return new ApiError(400, 'A referenced record does not exist');
      case '23514': // check constraint
      case '22P02': // invalid value for the column type
        return new ApiError(400, error.message);
      case 'P0001': // a trigger said no, e.g. "Variant X is used on a PR ... cannot be changed"
        return new ApiError(409, error.message);
      case '42501':
        return new ApiError(403, `Only an admin can create or change ${r.label}s`);
      default:
        return new ApiError(500, error.message);
    }
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
