import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { AuthUser } from '../../common/types/authenticated-request';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Session } from '../entities/session.entity';
import {
  InvalidSessionException,
  MissingSessionException,
} from '../exceptions/unauthenticated.exception';
import { AccessTokenService } from '../services/access-token.service';
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
    private readonly accessTokens: AccessTokenService,
    private readonly users: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<SessionRequest>();

    const cookieToken = this.cookies.read(request);
    if (cookieToken) {
      const resolved = await this.sessions.resolve(cookieToken);
      if (!resolved) {
        throw new InvalidSessionException();
      }
      request.user = toAuthUser(resolved.user, resolved.session);
      this.refreshCookie(http.getResponse<Response>(), cookieToken, resolved);
      return true;
    }

    const bearer = readBearer(request.headers.authorization);
    if (bearer) {
      try {
        const payload = await this.accessTokens.verify(bearer);
        const user = await this.users.findByIdWithPassword(payload.userId);
        if (!user) {
          throw new InvalidSessionException();
        }
        request.user = {
          id: user.id,
          userId: user.id,
          organizationId: user.organizationId,
          name: user.name,
          email: user.email,
          role: user.role,
          sessionId: payload.sessionId,
        };
        return true;
      } catch {
        throw new InvalidSessionException();
      }
    }

    throw new MissingSessionException();
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

function readBearer(header?: string): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
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
