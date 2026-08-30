import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './auth.guard';

/** The verified caller uid. Only meaningful on a route behind AuthGuard. */
export const Uid = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().uid;
});
