import { Test } from '@nestjs/testing';
import { AppLogger } from '../common/logger/app-logger.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/types/authenticated-request';
import { OrganizationService } from '../organization/organization.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { AmbiguousAccountException } from './exceptions/ambiguous-account.exception';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { SessionNotFoundException } from './exceptions/session-not-found.exception';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';

const CREDENTIALS = { email: 'berkay@example.com', password: 'berkay123' };

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    name: 'Berkay Bayar',
    email: 'berkay@example.com',
    role: UserRole.ADMIN,
    passwordHash: 'hash-1',
    organization: { id: 'org-1', name: 'Septem Montes', slug: 'septem-montes' },
    ...overrides,
  } as User;
}

function buildActor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    userId: 'user-1',
    organizationId: 'org-1',
    name: 'Berkay Bayar',
    email: 'berkay@example.com',
    role: UserRole.ADMIN,
    sessionId: 'session-1',
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<
      UserService,
      'findLoginCandidates' | 'findByIdWithPassword' | 'setPassword'
    >
  >;
  let sessions: jest.Mocked<
    Pick<
      SessionService,
      | 'issue'
      | 'revoke'
      | 'revokeAllForUser'
      | 'findOwned'
      | 'listActiveForUser'
    >
  >;
  let passwords: jest.Mocked<Pick<PasswordService, 'verify' | 'hash'>>;

  beforeEach(async () => {
    users = {
      findLoginCandidates: jest.fn(),
      findByIdWithPassword: jest.fn(),
      setPassword: jest.fn(),
    };

    sessions = {
      issue: jest.fn(() =>
        Promise.resolve({
          id: 'session-1',
          token: 'raw-token',
          expiresAt: new Date(Date.now() + 1000),
        }),
      ),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(() => Promise.resolve(2)),
      findOwned: jest.fn(),
      listActiveForUser: jest.fn(() => Promise.resolve([])),
    } as never;

    passwords = { verify: jest.fn(), hash: jest.fn() };

    const logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: users },
        { provide: SessionService, useValue: sessions },
        { provide: PasswordService, useValue: passwords },
        {
          provide: OrganizationService,
          useValue: { findBySlug: jest.fn() },
        },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      users.findLoginCandidates.mockResolvedValue([]);

      await expect(service.login(CREDENTIALS, {})).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it('still runs a comparison for an unknown email', async () => {
      users.findLoginCandidates.mockResolvedValue([]);

      await expect(service.login(CREDENTIALS, {})).rejects.toThrow();
      expect(passwords.verify).toHaveBeenCalledWith(CREDENTIALS.password, null);
    });

    it('rejects a wrong password', async () => {
      users.findLoginCandidates.mockResolvedValue([buildUser()]);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(CREDENTIALS, {})).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it('rejects an account that has no password set', async () => {
      users.findLoginCandidates.mockResolvedValue([
        buildUser({ passwordHash: null }),
      ]);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(CREDENTIALS, {})).rejects.toBeInstanceOf(
        InvalidCredentialsException,
      );
    });

    it('returns the user and a fresh session on success', async () => {
      users.findLoginCandidates.mockResolvedValue([buildUser()]);
      passwords.verify.mockResolvedValue(true);

      const result = await service.login(CREDENTIALS, { ip: '127.0.0.1' });

      expect(result.user).toEqual({
        id: 'user-1',
        organizationId: 'org-1',
        email: 'berkay@example.com',
        name: 'Berkay Bayar',
        role: UserRole.ADMIN,
      });
      expect(result.session.token).toBe('raw-token');
      expect(sessions.issue).toHaveBeenCalledWith('user-1', {
        ip: '127.0.0.1',
      });
    });

    it('keeps the token out of the user payload', async () => {
      users.findLoginCandidates.mockResolvedValue([buildUser()]);
      passwords.verify.mockResolvedValue(true);

      const result = await service.login(CREDENTIALS, {});

      expect(JSON.stringify(result.user)).not.toContain('raw-token');
    });

    it('asks which organization when the password matches several', async () => {
      users.findLoginCandidates.mockResolvedValue([
        buildUser({ id: 'user-1' }),
        buildUser({ id: 'user-2', organizationId: 'org-2' }),
      ]);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(CREDENTIALS, {})).rejects.toBeInstanceOf(
        AmbiguousAccountException,
      );
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it('signs in directly when only one of several accounts matches', async () => {
      users.findLoginCandidates.mockResolvedValue([
        buildUser({ id: 'user-1', passwordHash: 'hash-1' }),
        buildUser({ id: 'user-2', passwordHash: 'hash-2' }),
      ]);
      passwords.verify.mockImplementation((_password, hash) =>
        Promise.resolve(hash === 'hash-2'),
      );

      const result = await service.login(CREDENTIALS, {});

      expect(result.user.id).toBe('user-2');
    });

    it('narrows candidates by organization when one is supplied', async () => {
      users.findLoginCandidates.mockResolvedValue([buildUser()]);
      passwords.verify.mockResolvedValue(true);

      await service.login({ ...CREDENTIALS, organizationId: 'org-1' }, {});

      expect(users.findLoginCandidates).toHaveBeenCalledWith(
        CREDENTIALS.email,
        'org-1',
      );
    });
  });

  describe('me', () => {
    it('answers from the session without a further query', () => {
      expect(service.me(buildActor())).toEqual({
        id: 'user-1',
        organizationId: 'org-1',
        email: 'berkay@example.com',
        name: 'Berkay Bayar',
        role: UserRole.ADMIN,
      });
      expect(users.findByIdWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('refuses a session that does not belong to the caller', async () => {
      sessions.findOwned.mockResolvedValue(null);

      await expect(
        service.revokeSession(buildActor(), 'someone-elses-session'),
      ).rejects.toBeInstanceOf(SessionNotFoundException);
      expect(sessions.revoke).not.toHaveBeenCalled();
    });

    it('revokes a session the caller owns', async () => {
      sessions.findOwned.mockResolvedValue({ id: 'session-2' } as never);

      await service.revokeSession(buildActor(), 'session-2');

      expect(sessions.revoke).toHaveBeenCalledWith('session-2');
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      users.findByIdWithPassword.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.changePassword(buildActor(), {
          currentPassword: 'wrongpassword',
          newPassword: 'berkay1234',
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(users.setPassword).not.toHaveBeenCalled();
    });

    it('signs other devices out by default, keeping the caller signed in', async () => {
      users.findByIdWithPassword.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(true);

      const revoked = await service.changePassword(buildActor(), {
        currentPassword: 'berkay123',
        newPassword: 'berkay1234',
      });

      expect(users.setPassword).toHaveBeenCalledWith('user-1', 'berkay1234');
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
      expect(revoked).toBe(2);
    });

    it('leaves other devices signed in when asked to', async () => {
      users.findByIdWithPassword.mockResolvedValue(buildUser());
      passwords.verify.mockResolvedValue(true);

      const revoked = await service.changePassword(buildActor(), {
        currentPassword: 'berkay123',
        newPassword: 'berkay1234',
        revokeOtherSessions: false,
      });

      expect(revoked).toBe(0);
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
