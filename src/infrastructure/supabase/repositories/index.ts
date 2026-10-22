import { Provider } from '@nestjs/common';
import { GrnRepository } from '../../../application/grn/grn.repository';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { PrLinesRepository } from '../../../application/pr-lines/pr-lines.repository';
import { PrRepository } from '../../../application/pr/pr.repository';
import { StockRepository } from '../../../application/stock/stock.repository';
import { UsersRepository } from '../../../application/users/users.repository';
import { SupabaseGrnRepository } from './supabase-grn.repository';
import { SupabasePoLinesRepository } from './supabase-po-lines.repository';
import { SupabasePrLinesRepository } from './supabase-pr-lines.repository';
import { SupabasePrRepository } from './supabase-pr.repository';
import { SupabaseStockRepository } from './supabase-stock.repository';
import { SupabaseUsersRepository } from './supabase-users.repository';

/** Every repository port bound to its Supabase implementation (registered by SupabaseModule). */
export const REPOSITORIES: Provider[] = [
  { provide: GrnRepository, useClass: SupabaseGrnRepository },
  { provide: PoLinesRepository, useClass: SupabasePoLinesRepository },
  { provide: PrRepository, useClass: SupabasePrRepository },
  { provide: PrLinesRepository, useClass: SupabasePrLinesRepository },
  { provide: StockRepository, useClass: SupabaseStockRepository },
  { provide: UsersRepository, useClass: SupabaseUsersRepository },
];

export const REPOSITORY_TOKENS = [
  GrnRepository,
  PoLinesRepository,
  PrRepository,
  PrLinesRepository,
  StockRepository,
  UsersRepository,
];
