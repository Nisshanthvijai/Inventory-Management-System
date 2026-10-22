import { Provider } from '@nestjs/common';
import { PoLinesRepository } from '../../../application/po-lines/po-lines.repository';
import { SupabasePoLinesRepository } from './supabase-po-lines.repository';

/** Every repository port bound to its Supabase implementation (registered by SupabaseModule). */
export const REPOSITORIES: Provider[] = [
  { provide: PoLinesRepository, useClass: SupabasePoLinesRepository },
];

export const REPOSITORY_TOKENS = [PoLinesRepository];
