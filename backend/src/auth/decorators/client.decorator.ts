import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ClientInfo } from '../types/client-info';

export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = context.switchToHttp().getRequest<Request>();
    return {
      userAgent: request.get('user-agent'),
      ip: request.ip,
    };
  },
);
