import { Injectable } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { Database } from '../../../application/common/database.types';
import { untyped } from '../../../application/common/db';
import { UnexpectedError } from '../../../application/common/errors';
import { Session } from '../../../application/common/session';
import { MasterRepository } from '../../../application/master/master.repository';
import { MasterKey, masterResource } from '../../../application/master/master.resources';
import { Conflict, NotAllowed, RuleViolation } from '../../../domain/common/errors';
import { dbOf } from '../supabase-session';

type Schema = Database['public'];

/** Master-data tables, checked against the generated schema (a typo will not compile). */
type MasterTable = keyof Pick<
  Schema['Tables'],
  'uom' | 'brand' | 'item_category' | 'item_type' | 'item' | 'item_variant' | 'vendor'
>;

/** Where each master resource lives in the database. */
interface MasterTableInfo {
  table: MasterTable; // table written to
  select: string; // columns returned after create / update
  listFrom?: keyof Schema['Views']; // read from this view instead of the table
  listSelect?: string;
  order: string[];
}

export const MASTER_TABLES: Record<MasterKey, MasterTableInfo> = {
  uoms: { table: 'uom', select: 'id, code, name, is_active, created_at', order: ['code'] },
  brands: { table: 'brand', select: 'id, name, is_active, created_at', order: ['name'] },
  categories: { table: 'item_category', select: 'id, name, is_active, created_at', order: ['name'] },
  'item-types': { table: 'item_type', select: 'id, name, is_active, created_at', order: ['name'] },
  items: {
    table: 'item',
    select: 'id, name, description, category_id, is_active, created_at, updated_at',
    order: ['name'],
  },
  variants: {
    table: 'item_variant',
    select:
      'id, code, item_id, brand_id, type_id, inventory_uom_id, purchase_uom_id, units_per_purchase, reorder_level, is_active, created_at, updated_at',
    listFrom: 'v_variants', // adds names, units and "orderable"
    listSelect: '*',
    order: ['item_name', 'code'],
  },
  vendors: {
    table: 'vendor',
    select:
      'id, name, address, gst_no, contact_person, phone, email, is_active, created_at, updated_at',
    order: ['name'],
  },
};

/**
 * The table is chosen at runtime from MASTER_TABLES, so queries use the untyped client view;
 * the table names themselves are typed against the schema above.
 */
@Injectable()
export class SupabaseMasterRepository implements MasterRepository {
  async list(session: Session, key: MasterKey): Promise<unknown[]> {
    const t = MASTER_TABLES[key];
    let query = untyped(dbOf(session)).from(t.listFrom ?? t.table).select(t.listSelect ?? t.select);
    for (const column of t.order) query = query.order(column);
    const { data, error } = await query;
    if (error) throw new UnexpectedError(error.message);
    return data ?? [];
  }

  async create(session: Session, key: MasterKey, values: object): Promise<unknown> {
    const t = MASTER_TABLES[key];
    const { data, error } = await untyped(dbOf(session)).from(t.table).insert(values).select(t.select).single();
    if (error) throw writeError(error, key);
    return data;
  }

  async update(session: Session, key: MasterKey, id: string, values: object): Promise<unknown | null> {
    const t = MASTER_TABLES[key];
    const { data, error } = await untyped(dbOf(session))
      .from(t.table)
      .update(values)
      .eq('id', id)
      .select(t.select)
      .maybeSingle();
    if (error) throw writeError(error, key);
    return data;
  }
}

function writeError(error: PostgrestError, key: MasterKey) {
  const { label } = masterResource(key);
  switch (error.code) {
    case '23505': // unique
      return new Conflict(`A ${label} with these values already exists`);
    case '23503': // foreign key
      return new RuleViolation('A referenced record does not exist');
    case '23514': // check constraint
    case '22P02': // invalid value for the column type
      return new RuleViolation(error.message);
    case 'P0001': // a trigger said no, e.g. "Variant X is used on a PR ... cannot be changed"
      return new Conflict(error.message);
    case '42501':
      return new NotAllowed(`Only an admin can create or change ${label}s`);
    default:
      return new UnexpectedError(error.message);
  }
}
