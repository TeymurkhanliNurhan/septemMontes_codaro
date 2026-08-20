import { registerAs } from '@nestjs/config';
import { parseDuration } from '../../common/utils/duration';

export const SESSION_CONFIG_KEY = 'session';

const DAY = 86_400_000;
const HOUR = 3_600_000;

const DEFAULT_SLIDING_WINDOW = 30 * DAY;
const DEFAULT_ABSOLUTE_MAX = 90 * DAY;
const DEFAULT_TOUCH_INTERVAL = HOUR;
const DEFAULT_BCRYPT_ROUNDS = 12;
const DEFAULT_COOKIE_NAME = 'sm_session';
const MINIMUM_PEPPER_LENGTH = 32;
const DEVELOPMENT_PEPPER = 'development-only-session-pepper-do-not-ship';

export type SameSitePolicy = 'lax' | 'strict' | 'none';

export interface SessionConfig {
  pepper: string;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: SameSitePolicy;
  cookieDomain?: string;
  slidingWindowMs: number;
  absoluteMaxMs: number;
  touchIntervalMs: number;
  bcryptRounds: number;
}

function resolvePepper(isProduction: boolean): string {
  const pepper = process.env.SESSION_PEPPER;
  if (pepper && pepper.length >= MINIMUM_PEPPER_LENGTH) {
    return pepper;
  }
  if (isProduction) {
    throw new Error(
      `SESSION_PEPPER must be set to at least ${MINIMUM_PEPPER_LENGTH} characters in production. Generate one with: openssl rand -base64 48`,
    );
  }
  return DEVELOPMENT_PEPPER;
}

export default registerAs(SESSION_CONFIG_KEY, (): SessionConfig => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pepper: resolvePepper(isProduction),
    cookieName: process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME,
    cookieSecure: isProduction,
    cookieSameSite:
      (process.env.SESSION_COOKIE_SAMESITE as SameSitePolicy) || 'lax',
    cookieDomain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    slidingWindowMs: parseDuration(
      process.env.SESSION_SLIDING_WINDOW,
      DEFAULT_SLIDING_WINDOW,
    ),
    absoluteMaxMs: parseDuration(
      process.env.SESSION_ABSOLUTE_MAX,
      DEFAULT_ABSOLUTE_MAX,
    ),
    touchIntervalMs: parseDuration(
      process.env.SESSION_TOUCH_INTERVAL,
      DEFAULT_TOUCH_INTERVAL,
    ),
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? DEFAULT_BCRYPT_ROUNDS),
  };
});
