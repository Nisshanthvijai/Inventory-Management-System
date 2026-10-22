import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { Db } from './db';

/** Builds Supabase clients (anon key only; never the service_role key). Used inside infrastructure. */
@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
  }

  /** Client with no user. Used for login. */
  anon(): Db {
    return this.build({});
  }

  /** Client that acts as the user: their JWT is sent, so RLS applies. */
  forUser(token: string): Db {
    return this.build({ Authorization: `Bearer ${token}` });
  }

  private build(headers: Record<string, string>): Db {
    return createClient<Database>(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers },
    });
  }
}
