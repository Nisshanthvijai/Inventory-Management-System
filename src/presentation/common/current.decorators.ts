import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest } from './authed-request';

/** The Supabase client acting as the signed-in user (RLS applies). */
export const CurrentDb = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<AuthedRequest>().db,
);

/** The signed-in user: { id, email }. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
