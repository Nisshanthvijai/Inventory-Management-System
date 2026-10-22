import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthProvider } from '../../application/auth/auth-provider';
import { DbFactory } from '../../application/common/db-factory';
import { AuthedRequest } from './authed-request';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthProvider,
    private readonly db: DbFactory,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : '';
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const user = await this.auth.verifyToken(token);
    if (!user) throw new UnauthorizedException('Invalid or expired token');

    req.user = user;
    req.token = token;
    req.db = this.db.forUser(token);
    return true;
  }
}
