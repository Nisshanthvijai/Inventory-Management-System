import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, SignInResult } from '../../application/auth/auth-provider';
import { AuthUser } from '../../domain/common/auth-user';
import { SupabaseService } from './supabase.service';

@Injectable()
export class SupabaseAuthProvider implements AuthProvider {
  private readonly logger = new Logger(SupabaseAuthProvider.name);

  constructor(private readonly supabase: SupabaseService) {}

  async signIn(email: string, password: string): Promise<SignInResult | null> {
    const { data, error } = await this.supabase
      .anon()
      .auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: { id: data.user.id, email: data.user.email },
    };
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    const { data, error } = await this.supabase.anon().auth.getUser(token);
    if (error || !data.user) {
      this.logger.warn(
        `getUser rejected the token: ${error?.name} status=${error?.status} ${error?.message}`,
      );
      return null;
    }
    return { id: data.user.id, email: data.user.email };
  }
}
