import { MasterKey } from '../../application/master/master.resources';

/** The URL path under /api for each master-data resource. */
export const MASTER_PATHS: Record<MasterKey, string> = {
  uoms: 'uoms',
  brands: 'brands',
  categories: 'categories',
  'item-types': 'item-types',
  items: 'items',
  variants: 'variants',
  vendors: 'vendors',
};
