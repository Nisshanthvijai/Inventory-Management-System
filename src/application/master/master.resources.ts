import { z } from 'zod';
import { Database } from '../common/database.types';

type Schema = Database['public'];

/** Master-data tables, checked against the generated schema (a typo will not compile). */
export type MasterTable = keyof Pick<
  Schema['Tables'],
  'uom' | 'brand' | 'item_category' | 'item_type' | 'item' | 'item_variant' | 'vendor'
>;

/**
 * One entry per master-data table. The generic service and the controller factory
 * read these, so every table gets the same list / create / update behaviour.
 * No defaults here: the database fills is_active, units_per_purchase and reorder_level.
 */
export interface MasterResource {
  path: string; // URL path under /api
  table: MasterTable; // table written to
  label: string; // used in messages: "brand", "item variant"
  select: string; // columns returned after create / update
  listFrom?: keyof Schema['Views']; // read from this view instead of the table
  listSelect?: string;
  order: string[];
  readRole: 'user' | 'manager'; // who may list (writes are always admin-only)
  create: z.ZodType;
  update: z.ZodType;
}

const text = z.string().trim().min(1);
const optionalText = text.nullable().optional();
const active = z.boolean().optional();
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** create = the full shape; update = every field optional, but at least one. */
function schemas(shape: z.ZodRawShape) {
  return {
    create: z.strictObject(shape),
    update: z
      .strictObject(shape)
      .partial()
      .refine((o) => Object.keys(o).length > 0, 'Send at least one field to change'),
  };
}

const named = schemas({ name: text, is_active: active });

export const MASTER_RESOURCES: MasterResource[] = [
  {
    path: 'uoms',
    table: 'uom',
    label: 'unit',
    select: 'id, code, name, is_active, created_at',
    order: ['code'],
    readRole: 'user',
    ...schemas({ code: text, name: text, is_active: active }),
  },
  {
    path: 'brands',
    table: 'brand',
    label: 'brand',
    select: 'id, name, is_active, created_at',
    order: ['name'],
    readRole: 'user',
    ...named,
  },
  {
    path: 'categories',
    table: 'item_category',
    label: 'category',
    select: 'id, name, is_active, created_at',
    order: ['name'],
    readRole: 'user',
    ...named,
  },
  {
    path: 'item-types',
    table: 'item_type',
    label: 'item type',
    select: 'id, name, is_active, created_at',
    order: ['name'],
    readRole: 'user',
    ...named,
  },
  {
    path: 'items',
    table: 'item',
    label: 'item',
    select: 'id, name, description, category_id, is_active, created_at, updated_at',
    order: ['name'],
    readRole: 'user',
    ...schemas({ name: text, description: optionalText, category_id: z.uuid(), is_active: active }),
  },
  {
    path: 'variants',
    table: 'item_variant',
    label: 'item variant',
    select:
      'id, code, item_id, brand_id, type_id, inventory_uom_id, purchase_uom_id, units_per_purchase, reorder_level, is_active, created_at, updated_at',
    listFrom: 'v_variants', // adds names, units and "orderable"
    listSelect: '*',
    order: ['item_name', 'code'],
    readRole: 'user',
    ...schemas({
      code: text,
      item_id: z.uuid(),
      brand_id: z.uuid(),
      type_id: z.uuid(),
      inventory_uom_id: z.uuid(), // the stock unit
      purchase_uom_id: z.uuid(), // the buying unit
      units_per_purchase: z.number().positive().optional(), // stock units in one purchase unit
      reorder_level: z.number().min(0).optional(),
      is_active: active,
    }),
  },
  {
    path: 'vendors',
    table: 'vendor',
    label: 'vendor',
    select:
      'id, name, address, gst_no, contact_person, phone, email, is_active, created_at, updated_at',
    order: ['name'],
    readRole: 'manager', // vendors are only visible to managers and admins
    ...schemas({
      name: text,
      address: optionalText,
      gst_no: z.string().trim().toUpperCase().regex(GSTIN, 'Invalid GSTIN').nullable().optional(),
      contact_person: optionalText,
      phone: optionalText,
      email: z.email().nullable().optional(),
      is_active: active,
    }),
  },
];
