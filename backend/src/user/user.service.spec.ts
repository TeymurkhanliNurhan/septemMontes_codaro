import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/types/authenticated-request';
import { User } from './entities/user.entity';
import { UserAccessPolicy } from './user-access.policy';
import { UserService } from './user.service';

function buildActor(
  role: UserRole,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: 'actor-1',
    userId: 'actor-1',
    organizationId: 'org-1',
    name: 'Berkay Bayar',
    email: 'berkay@example.com',
    role,
    sessionId: 'session-1',
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-2',
    organizationId: 'org-1',
    name: 'Berkay Bayar',
    email: 'berkay@example.com',
    role: UserRole.STAFF,
    passwordHash: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<Repository<User>>;
  let sessions: { revokeAllForUser: jest.Mock };
  let stored: User | null;

  beforeEach(async () => {
    stored = buildUser();

    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(() => Promise.resolve(stored)),
      getMany: jest.fn(() => Promise.resolve(stored ? [stored] : [])),
    };

    repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      create: jest.fn((input: Partial<User>) => buildUser(input)),
      save: jest.fn((input: User) => Promise.resolve(input)),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    } as unknown as jest.Mocked<Repository<User>>;

    sessions = { revokeAllForUser: jest.fn(() => Promise.resolve(0)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        UserAccessPolicy,
        { provide: getRepositoryToken(User), useValue: repository },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn(() => Promise.resolve('hashed')),
            verify: jest.fn(),
          },
        },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  function createdUser(): User {
    return repository.create.mock.calls[0][0] as User;
  }

  describe('tenant isolation', () => {
    it('creates into the caller organization', async () => {
      await service.create(
        { name: 'Berkay Bayar', email: 'berkay@example.com' },
        buildActor(UserRole.ADMIN, { organizationId: 'org-1' }),
      );

      expect(createdUser().organizationId).toBe('org-1');
    });

    it('normalizes the email so casing cannot fork an account', async () => {
      await service.create(
        { name: 'Berkay Bayar', email: '  Berkay@Example.COM ' },
        buildActor(UserRole.ADMIN),
      );

      expect(createdUser().email).toBe('berkay@example.com');
    });

    it('hides a user from another organization behind a 404', async () => {
      stored = buildUser({ organizationId: 'org-999' });

      await expect(
        service.update({ id: 'user-2', name: 'x' }, buildActor(UserRole.OWNER)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to delete a user from another organization', async () => {
      stored = buildUser({ organizationId: 'org-999' });

      await expect(
        service.remove('user-2', buildActor(UserRole.OWNER)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('role rules', () => {
    it('stops an admin from creating an owner', async () => {
      await expect(
        service.create(
          {
            name: 'Berkay Bayar',
            email: 'berkay@example.com',
            role: UserRole.OWNER,
          },
          buildActor(UserRole.ADMIN),
        ),
      ).rejects.toThrow('You cannot grant a role above your own (ADMIN)');
    });

    it('stops an admin from promoting someone to owner', async () => {
      await expect(
        service.update(
          { id: 'user-2', role: UserRole.OWNER },
          buildActor(UserRole.ADMIN),
        ),
      ).rejects.toThrow('You cannot grant a role above your own (ADMIN)');
    });

    it('stops an admin from modifying an owner', async () => {
      stored = buildUser({ role: UserRole.OWNER });

      await expect(
        service.update({ id: 'user-2', name: 'x' }, buildActor(UserRole.ADMIN)),
      ).rejects.toThrow('You cannot modify a user with the OWNER role');
    });

    it('stops anyone from changing their own role', async () => {
      stored = buildUser({ id: 'actor-1', role: UserRole.OWNER });

      await expect(
        service.update(
          { id: 'actor-1', role: UserRole.STAFF },
          buildActor(UserRole.OWNER),
        ),
      ).rejects.toThrow('You cannot change your own role');
    });

    it('stops anyone from deleting their own account', async () => {
      stored = buildUser({ id: 'actor-1', role: UserRole.OWNER });

      await expect(
        service.remove('actor-1', buildActor(UserRole.OWNER)),
      ).rejects.toThrow('You cannot delete your own account');
    });

    it('lets an owner promote a staff member to admin', async () => {
      const result = await service.update(
        { id: 'user-2', role: UserRole.ADMIN },
        buildActor(UserRole.OWNER),
      );

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('allows an unchanged role to pass through on a self edit', async () => {
      stored = buildUser({ id: 'actor-1', role: UserRole.OWNER });

      const result = await service.update(
        { id: 'actor-1', role: UserRole.OWNER, name: 'Berkay Bayar' },
        buildActor(UserRole.OWNER),
      );

      expect(result.name).toBe('Berkay Bayar');
    });
  });

  describe('passwords', () => {
    it('reports whether an account can log in without exposing the hash', async () => {
      stored = buildUser({ passwordHash: 'a-bcrypt-hash' });

      const result = await service.findOne('user-2', 'org-1');

      expect(result.hasPassword).toBe(true);
      expect(JSON.stringify(result)).not.toContain('a-bcrypt-hash');
    });

    it('reports an account with no password as unable to log in', async () => {
      const result = await service.findOne('user-2', 'org-1');

      expect(result.hasPassword).toBe(false);
    });

    it('signs the target out everywhere when an admin resets their password', async () => {
      await service.update(
        { id: 'user-2', password: 'berkay123' },
        buildActor(UserRole.ADMIN),
      );

      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-2');
    });

    it('leaves sessions alone for an ordinary profile edit', async () => {
      await service.update(
        { id: 'user-2', name: 'Berkay Bayar' },
        buildActor(UserRole.ADMIN),
      );

      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('creates an account without a password when none is given', async () => {
      await service.create(
        { name: 'Berkay Bayar', email: 'berkay@example.com' },
        buildActor(UserRole.ADMIN),
      );

      expect(createdUser().passwordHash).toBeNull();
    });
  });
});
