import { AuthUser } from '../../domain/common/auth-user';

export interface SignInResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

/** How the app proves who someone is. Infrastructure provides the real one. */
export abstract class AuthProvider {
  /** Email and password in; tokens and user out. null if the credentials are wrong. */
  abstract signIn(email: string, password: string): Promise<SignInResult | null>;

  /** Token in; the user it belongs to out. null if the token is invalid or expired. */
  abstract verifyToken(token: string): Promise<AuthUser | null>;
}
