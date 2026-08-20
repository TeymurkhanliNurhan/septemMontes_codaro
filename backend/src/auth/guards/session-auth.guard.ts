import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { AuthUser } from '../../common/types/authenticated-request';
import { User } from '../../user/entities/user.entity';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Session } from '../entities/session.entity';
import {
  InvalidSessionException,
  MissingSessionException,
} from '../exceptions/unauthenticated.exception';
import { SessionCookieService } from '../services/session-cookie.service';
import {
  ResolvedSession,
  SessionService,
} from '../services/session.service';
import { SessionRequest } from '../types/session-request';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly cookies: SessionCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<SessionRequest>();

    const token = this.cookies.read(request);
    if (!token) {
      throw new MissingSessionException();
    }

    const resolved = await this.sessions.resolve(token);
    if (!resolved) {
      throw new InvalidSessionException();
    }

    request.user = toAuthUser(resolved.user, resolved.session);
    this.refreshCookie(http.getResponse<Response>(), token, resolved);

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private refreshCookie(
    response: Response,
    token: string,
    resolved: ResolvedSession,
  ): void {
    if (resolved.renewedUntil) {
      this.cookies.write(response, {
        token,
        expiresAt: resolved.renewedUntil,
      });
    }
  }
}

function toAuthUser(user: User, session: Session): AuthUser {
  return {
    id: user.id,
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionId: session.id,
  };
}
