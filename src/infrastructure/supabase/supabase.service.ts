import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DbFactory } from '../../application/common/db-factory';

@Injectable()
export class SupabaseService implements DbFactory {
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
  }

  /** Client with no user. Used for login. */
  anon(): SupabaseClient {
    return this.build({});
  }

  /** Client that acts as the user: their JWT is sent, so RLS applies. */
  forUser(token: string): SupabaseClient {
    return this.build({ Authorization: `Bearer ${token}` });
  }

  private build(headers: Record<string, string>): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers },
    });
  }
}
