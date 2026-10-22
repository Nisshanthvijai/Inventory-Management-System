import { Injectable } from '@nestjs/common';
import { Db } from './db';
import { Session, SessionFactory } from '../../application/common/session';
import { SupabaseService } from './supabase.service';

/** A Session backed by a Supabase client that sends the user's JWT. */
export class SupabaseSession extends Session {
  constructor(readonly db: Db) {
    super();
  }
}

/** The Supabase client inside a Session. Only infrastructure (repositories) may call this. */
export function dbOf(session: Session): Db {
  if (!(session instanceof SupabaseSession)) throw new Error('Not a Supabase session');
  return session.db;
}

@Injectable()
export class SupabaseSessionFactory implements SessionFactory {
  constructor(private readonly supabase: SupabaseService) {}

  forUser(token: string): Session {
    return new SupabaseSession(this.supabase.forUser(token));
  }
}
