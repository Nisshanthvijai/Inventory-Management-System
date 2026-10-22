import { Provider } from '@nestjs/common';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { StockRepository } from '../../../application/stock/stock.repository';
import { UsersRepository } from '../../../application/users/users.repository';
import { SupabasePoLinesRepository } from './supabase-po-lines.repository';
import { SupabaseStockRepository } from './supabase-stock.repository';
import { SupabaseUsersRepository } from './supabase-users.repository';

/** Every repository port bound to its Supabase implementation (registered by SupabaseModule). */
export const REPOSITORIES: Provider[] = [
  { provide: PoLinesRepository, useClass: SupabasePoLinesRepository },
  { provide: StockRepository, useClass: SupabaseStockRepository },
  { provide: UsersRepository, useClass: SupabaseUsersRepository },
];

export const REPOSITORY_TOKENS = [PoLinesRepository, StockRepository, UsersRepository];
