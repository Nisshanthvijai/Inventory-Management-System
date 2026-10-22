import { Provider } from '@nestjs/common';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { StockRepository } from '../../../application/stock/stock.repository';
import { SupabasePoLinesRepository } from './supabase-po-lines.repository';
import { SupabaseStockRepository } from './supabase-stock.repository';

/** Every repository port bound to its Supabase implementation (registered by SupabaseModule). */
export const REPOSITORIES: Provider[] = [
  { provide: PoLinesRepository, useClass: SupabasePoLinesRepository },
  { provide: StockRepository, useClass: SupabaseStockRepository },
];

export const REPOSITORY_TOKENS = [PoLinesRepository, StockRepository];
