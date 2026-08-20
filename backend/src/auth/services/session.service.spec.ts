import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../user/entities/user.entity';
import sessionConfig, { SessionConfig } from '../config/session.config';
import { Session } from '../entities/session.entity';
import { SessionService } from './session.service';
import { SessionTokenService } from './session-token.service';

const HOUR = 3_600_000;
const DAY = 86_400_000;

const config: SessionConfig = {
  pepper: 'a-test-pepper-long-enough-to-be-accepted',
  cookieName: 'sm_session',
  cookieSecure: false,
  cookieSameSite: 'lax',
  slidingWindowMs: 30 * DAY,
  absoluteMaxMs: 90 * DAY,
  touchIntervalMs: HOUR,
  bcryptRounds: 4,
};

function buildSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  const session = new Session();

  Object.assign(session, {
    id: 'session-1',
    userId: 'user-1',
    user: { id: 'user-1', role: UserRole.STAFF } as User,
    tokenHash: 'unset',
    userAgent: null,
    ip: null,
    createdAt: new Date(now),
    lastUsedAt: new Date(now),
    expiresAt: new Date(now + 30 * DAY),
    absoluteExpiresAt: new Date(now + 90 * DAY),
    revokedAt: null,
    ...overrides,
  });

  return session;
}

describe('SessionService', () => {
  let service: SessionService;
  let tokens: SessionTokenService;
  let repository: jest.Mocked<Repository<Session>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn((input: Partial<Session>) => buildSession(input)),
      save: jest.fn((input: Session) => Promise.resolve(input)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 0 })),
    } as unknown as jest.Mocked<Repository<Session>>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionService,
        SessionTokenService,
        { provide: getRepositoryToken(Session), useValue: repository },
        { provide: sessionConfig.KEY, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(SessionService);
    tokens = moduleRef.get(SessionTokenService);
  });

  function savedSession(): Session {
    return repository.save.mock.calls[0][0] as Session;
  }

  describe('issue', () => {
    it('stores a hash rather than the token itself', async () => {
      const issued = await service.issue('user-1');

      expect(savedSession().tokenHash).not.toBe(issued.token);
      expect(savedSession().tokenHash).toBe(tokens.hash(issued.token));
    });

    it('returns a token with 256 bits of entropy', async () => {
      const issued = await service.issue('user-1');

      expect(Buffer.from(issued.token, 'base64url')).toHaveLength(32);
    });

    it('issues a distinct token each time', async () => {
      const first = await service.issue('user-1');
      const second = await service.issue('user-1');

      expect(first.token).not.toBe(second.token);
    });

    it('caps the sliding window with a later absolute deadline', async () => {
      await service.issue('user-1');

      expect(savedSession().absoluteExpiresAt.getTime()).toBeGreaterThan(
        savedSession().expiresAt.getTime(),
      );
    });

    it('truncates an oversized user agent to the column width', async () => {
      await service.issue('user-1', { userAgent: 'x'.repeat(1000) });

      expect(savedSession().userAgent).toHaveLength(512);
    });

    it('records a missing user agent as null', async () => {
      await service.issue('user-1');

      expect(savedSession().userAgent).toBeNull();
      expect(savedSession().ip).toBeNull();
    });
  });

  describe('resolve', () => {
    it('returns the session and its user for a live token', async () => {
      repository.findOne.mockResolvedValue(buildSession());

      const resolved = await service.resolve('any-token');

      expect(resolved?.user.id).toBe('user-1');
      expect(resolved?.renewedUntil).toBeNull();
    });

    it('looks the session up by hash, never by raw token', async () => {
      repository.findOne.mockResolvedValue(buildSession());

      await service.resolve('raw-token');

      expect(repository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: tokens.hash('raw-token') },
        }),
      );
    });

    it('rejects an empty token without querying', async () => {
      expect(await service.resolve('')).toBeNull();
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      repository.findOne.mockResolvedValue(null);

      expect(await service.resolve('unknown')).toBeNull();
    });

    it('rejects a revoked session', async () => {
      repository.findOne.mockResolvedValue(
        buildSession({ revokedAt: new Date() }),
      );

      expect(await service.resolve('any-token')).toBeNull();
    });

    it('rejects a session past its sliding deadline', async () => {
      repository.findOne.mockResolvedValue(
        buildSession({ expiresAt: new Date(Date.now() - 1000) }),
      );

      expect(await service.resolve('any-token')).toBeNull();
    });

    it('rejects a session past its absolute deadline even when recently used', async () => {
      repository.findOne.mockResolvedValue(
        buildSession({
          expiresAt: new Date(Date.now() + DAY),
          absoluteExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      expect(await service.resolve('any-token')).toBeNull();
    });
  });

  describe('sliding renewal', () => {
    it('leaves a recently used session untouched', async () => {
      repository.findOne.mockResolvedValue(
        buildSession({ lastUsedAt: new Date(Date.now() - 60_000) }),
      );

      const resolved = await service.resolve('any-token');

      expect(resolved?.renewedUntil).toBeNull();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('extends a session that has gone quiet past the touch interval', async () => {
      repository.findOne.mockResolvedValue(
        buildSession({
          lastUsedAt: new Date(Date.now() - 2 * HOUR),
          expiresAt: new Date(Date.now() + DAY),
        }),
      );

      const resolved = await service.resolve('any-token');

      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(resolved?.renewedUntil?.getTime()).toBeGreaterThan(
        Date.now() + 29 * DAY,
      );
    });

    it('never extends beyond the absolute deadline', async () => {
      const ceiling = new Date(Date.now() + 2 * DAY);
      repository.findOne.mockResolvedValue(
        buildSession({
          lastUsedAt: new Date(Date.now() - 2 * HOUR),
          expiresAt: new Date(Date.now() + DAY),
          absoluteExpiresAt: ceiling,
        }),
      );

      const resolved = await service.resolve('any-token');

      expect(resolved?.renewedUntil).toEqual(ceiling);
    });
  });

  describe('revocation', () => {
    function updateCall(): [Record<string, unknown>, Record<string, unknown>] {
      const [criteria, changes] = repository.update.mock.calls[0];
      return [criteria as Record<string, unknown>, changes];
    }

    it('stamps a revocation time on a matching session', async () => {
      await service.revoke('session-1');
      const [criteria, changes] = updateCall();

      expect(criteria.id).toBe('session-1');
      expect(changes.revokedAt).toBeInstanceOf(Date);
    });

    it('leaves an already revoked session as it was', async () => {
      await service.revoke('session-1');
      const [criteria] = updateCall();

      expect(criteria.revokedAt).toBeDefined();
    });

    it('revokes every session for a user when no exception is given', async () => {
      await service.revokeAllForUser('user-1');
      const [criteria] = updateCall();

      expect(criteria.userId).toBe('user-1');
      expect(criteria.id).toBeUndefined();
    });

    it('spares the caller session when one is given', async () => {
      await service.revokeAllForUser('user-1', 'session-1');
      const [criteria] = updateCall();

      expect(criteria.userId).toBe('user-1');
      expect(criteria.id).toBeDefined();
    });

    it('reports how many sessions it revoked', async () => {
      expect(await service.revokeAllForUser('user-1')).toBe(1);
    });
  });
});
