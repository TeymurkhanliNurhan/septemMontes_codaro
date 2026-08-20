import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import sessionConfig from '../config/session.config';
import { IssuedSession } from '../types/session-tokens';

type CookieCarrier = Pick<IssuedSession, 'token' | 'expiresAt'>;

@Injectable()
export class SessionCookieService {
  constructor(
    @Inject(sessionConfig.KEY)
    private readonly config: ConfigType<typeof sessionConfig>,
  ) {}

  read(request: Request): string {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[this.config.cookieName] ?? '';
  }

  write(response: Response, session: CookieCarrier): void {
    response.cookie(this.config.cookieName, session.token, {
      ...this.baseOptions,
      expires: session.expiresAt,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.config.cookieName, this.baseOptions);
  }

  private get baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      path: '/',
      ...(this.config.cookieDomain ? { domain: this.config.cookieDomain } : {}),
    };
  }
}
