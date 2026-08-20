import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../common/types/authenticated-request';
import { SessionRequest } from '../types/session-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<SessionRequest>().user as AuthUser,
);
