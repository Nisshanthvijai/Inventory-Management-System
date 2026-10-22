import { z } from 'zod';
import { Action } from '../../domain/common/permissions';

/** The master-data resources. Each layer keys its own part of the config by these. */
export const MASTER_KEYS = ['uoms', 'brands', 'categories', 'item-types', 'items', 'variants', 'vendors'] as const;
export type MasterKey = (typeof MASTER_KEYS)[number];

/**
 * The application's part of a master-data resource: its name in messages, who may list it and
 * what a create / update body must look like. The URL path lives in presentation
 * (master.routes.ts); the table and columns live in infrastructure (the master repository).
 * No defaults here: the database fills is_active, units_per_purchase and reorder_level.
 */
export interface MasterResource {
  key: MasterKey;
  label: string; // used in messages: "brand", "item variant"
  /** Permission needed to list; none means any signed-in user. Writes always need 'master.write'. */
  readPermission?: Action;
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
  { key: 'uoms', label: 'unit', ...schemas({ code: text, name: text, is_active: active }) },
  { key: 'brands', label: 'brand', ...named },
  { key: 'categories', label: 'category', ...named },
  { key: 'item-types', label: 'item type', ...named },
  {
    key: 'items',
    label: 'item',
    ...schemas({ name: text, description: optionalText, category_id: z.uuid(), is_active: active }),
  },
  {
    key: 'variants',
    label: 'item variant',
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
    key: 'vendors',
    label: 'vendor',
    readPermission: 'master.view-restricted', // vendors are only visible to managers and admins
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

export function masterResource(key: MasterKey): MasterResource {
  const resource = MASTER_RESOURCES.find((r) => r.key === key);
  if (!resource) throw new Error(`Unknown master resource: ${key}`);
  return resource;
}
