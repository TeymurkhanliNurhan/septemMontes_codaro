import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import sessionConfig from '../config/session.config';
import { Session } from '../entities/session.entity';
import { ClientInfo } from '../types/client-info';
import { IssuedSession } from '../types/session-tokens';
import { SessionTokenService } from './session-token.service';

const USER_AGENT_MAX_LENGTH = 512;
const IP_MAX_LENGTH = 64;

export interface ResolvedSession {
  session: Session;
  user: User;
  renewedUntil: Date | null;
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    private readonly tokens: SessionTokenService,
    @Inject(sessionConfig.KEY)
    private readonly config: ConfigType<typeof sessionConfig>,
  ) {}

  async issue(userId: string, client: ClientInfo = {}): Promise<IssuedSession> {
    const token = this.tokens.generate();
    const issuedAt = new Date();

    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        tokenHash: this.tokens.hash(token),
        userAgent: truncate(client.userAgent, USER_AGENT_MAX_LENGTH),
        ip: truncate(client.ip, IP_MAX_LENGTH),
        lastUsedAt: issuedAt,
        expiresAt: new Date(issuedAt.getTime() + this.config.slidingWindowMs),
        absoluteExpiresAt: new Date(
          issuedAt.getTime() + this.config.absoluteMaxMs,
        ),
        revokedAt: null,
      }),
    );

    return { id: session.id, token, expiresAt: session.expiresAt };
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    if (!token) {
      return null;
    }

    const session = await this.sessions.findOne({
      where: { tokenHash: this.tokens.hash(token) },
      relations: { user: true },
    });

    if (!session?.user || !session.isActive()) {
      return null;
    }

    return {
      session,
      user: session.user,
      renewedUntil: await this.renewIfStale(session),
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(
    userId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.sessions.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(exceptSessionId ? { id: Not(exceptSessionId) } : {}),
      },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  listActiveForUser(userId: string): Promise<Session[]> {
    return this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
  }

  findOwned(sessionId: string, userId: string): Promise<Session | null> {
    return this.sessions.findOne({ where: { id: sessionId, userId } });
  }

  async purgeExpired(): Promise<number> {
    const result = await this.sessions.delete({
      absoluteExpiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  private async renewIfStale(session: Session): Promise<Date | null> {
    const now = new Date();
    if (!session.isStale(this.config.touchIntervalMs, now)) {
      return null;
    }

    const expiresAt = new Date(
      Math.min(
        now.getTime() + this.config.slidingWindowMs,
        session.absoluteExpiresAt.getTime(),
      ),
    );

    await this.sessions.update(session.id, { lastUsedAt: now, expiresAt });
    session.lastUsedAt = now;
    session.expiresAt = expiresAt;

    return expiresAt;
  }
}

function truncate(value: string | undefined, maxLength: number): string | null {
  return value ? value.slice(0, maxLength) : null;
}
