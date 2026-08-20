import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';

describe('Service-resource relationship RBAC (RolesGuard)', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const makeContext = (role: UserRole) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as never;

  describe('attach/detach mutate roles', () => {
    beforeEach(() => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.OWNER,
        UserRole.ADMIN,
      ]);
    });

    it('allows OWNER to attach resource', () => {
      expect(guard.canActivate(makeContext(UserRole.OWNER))).toBe(true);
    });

    it('allows ADMIN to attach resource', () => {
      expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
    });

    it('forbids STAFF from attach resource', () => {
      expect(() => guard.canActivate(makeContext(UserRole.STAFF))).toThrow(
        ForbiddenException,
      );
    });

    it('forbids CUSTOMER from attach resource', () => {
      expect(() => guard.canActivate(makeContext(UserRole.CUSTOMER))).toThrow(
        ForbiddenException,
      );
    });

    it('allows OWNER to detach resource', () => {
      expect(guard.canActivate(makeContext(UserRole.OWNER))).toBe(true);
    });

    it('allows ADMIN to detach resource', () => {
      expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
    });

    it('forbids STAFF from detach resource', () => {
      expect(() => guard.canActivate(makeContext(UserRole.STAFF))).toThrow(
        ForbiddenException,
      );
    });

    it('forbids CUSTOMER from detach resource', () => {
      expect(() => guard.canActivate(makeContext(UserRole.CUSTOMER))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('list resources read roles', () => {
    beforeEach(() => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.STAFF,
      ]);
    });

    it('allows STAFF to list service resources', () => {
      expect(guard.canActivate(makeContext(UserRole.STAFF))).toBe(true);
    });

    it('forbids CUSTOMER from listing service resources', () => {
      expect(() => guard.canActivate(makeContext(UserRole.CUSTOMER))).toThrow(
        ForbiddenException,
      );
    });
  });
});
