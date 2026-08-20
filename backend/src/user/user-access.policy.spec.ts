import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/types/authenticated-request';
import { User } from './entities/user.entity';
import { UserAccessPolicy } from './user-access.policy';

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

function buildTarget(role: UserRole, id = 'user-2'): User {
  return { id, role, organizationId: 'org-1' } as User;
}

describe('UserAccessPolicy', () => {
  const policy = new UserAccessPolicy();

  describe('assertCanAssignRole', () => {
    it.each([
      [UserRole.OWNER, UserRole.OWNER],
      [UserRole.OWNER, UserRole.ADMIN],
      [UserRole.ADMIN, UserRole.ADMIN],
      [UserRole.ADMIN, UserRole.STAFF],
      [UserRole.STAFF, UserRole.CUSTOMER],
    ])('lets %s assign %s', (actorRole, role) => {
      expect(() =>
        policy.assertCanAssignRole(buildActor(actorRole), role),
      ).not.toThrow();
    });

    it.each([
      [UserRole.ADMIN, UserRole.OWNER],
      [UserRole.STAFF, UserRole.ADMIN],
      [UserRole.CUSTOMER, UserRole.STAFF],
    ])('stops %s from assigning %s', (actorRole, role) => {
      expect(() =>
        policy.assertCanAssignRole(buildActor(actorRole), role),
      ).toThrow(ForbiddenException);
    });
  });

  describe('assertCanManage', () => {
    it('lets an owner manage an admin', () => {
      expect(() =>
        policy.assertCanManage(
          buildActor(UserRole.OWNER),
          buildTarget(UserRole.ADMIN),
        ),
      ).not.toThrow();
    });

    it('lets an admin manage another admin', () => {
      expect(() =>
        policy.assertCanManage(
          buildActor(UserRole.ADMIN),
          buildTarget(UserRole.ADMIN),
        ),
      ).not.toThrow();
    });

    it('stops an admin from managing an owner', () => {
      expect(() =>
        policy.assertCanManage(
          buildActor(UserRole.ADMIN),
          buildTarget(UserRole.OWNER),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('self-protection', () => {
    it('stops anyone from changing their own role', () => {
      expect(() =>
        policy.assertNotSelfRoleChange(
          buildActor(UserRole.OWNER),
          buildTarget(UserRole.OWNER, 'actor-1'),
        ),
      ).toThrow(ForbiddenException);
    });

    it('allows a role change for someone else', () => {
      expect(() =>
        policy.assertNotSelfRoleChange(
          buildActor(UserRole.OWNER),
          buildTarget(UserRole.STAFF),
        ),
      ).not.toThrow();
    });

    it('stops anyone from deleting their own account', () => {
      expect(() =>
        policy.assertNotSelfDeletion(
          buildActor(UserRole.OWNER),
          buildTarget(UserRole.OWNER, 'actor-1'),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
