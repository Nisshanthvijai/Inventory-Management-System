import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest } from './authed-request';

/** The signed-in user's Session: the database acting as them (RLS applies). */
export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<AuthedRequest>().session,
);

/** The signed-in user: { id, email }. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
