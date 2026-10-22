import { Provider } from '@nestjs/common';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { PrLinesRepository } from '../../../application/pr-lines/pr-lines.repository';
import { PrRepository } from '../../../application/pr/pr.repository';
import { StockRepository } from '../../../application/stock/stock.repository';
import { UsersRepository } from '../../../application/users/users.repository';
import { SupabasePoLinesRepository } from './supabase-po-lines.repository';
import { SupabasePrLinesRepository } from './supabase-pr-lines.repository';
import { SupabasePrRepository } from './supabase-pr.repository';
import { SupabaseStockRepository } from './supabase-stock.repository';
import { SupabaseUsersRepository } from './supabase-users.repository';

/** Every repository port bound to its Supabase implementation (registered by SupabaseModule). */
export const REPOSITORIES: Provider[] = [
  { provide: PoLinesRepository, useClass: SupabasePoLinesRepository },
  { provide: PrRepository, useClass: SupabasePrRepository },
  { provide: PrLinesRepository, useClass: SupabasePrLinesRepository },
  { provide: StockRepository, useClass: SupabaseStockRepository },
  { provide: UsersRepository, useClass: SupabaseUsersRepository },
];

export const REPOSITORY_TOKENS = [
  PoLinesRepository,
  PrRepository,
  PrLinesRepository,
  StockRepository,
  UsersRepository,
];
