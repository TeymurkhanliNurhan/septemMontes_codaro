import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

describe('AvailabilityException management RBAC (RolesGuard)', () => {
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

  beforeEach(() => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
    ]);
  });

  it('allows OWNER to create/update/delete exceptions', () => {
    expect(guard.canActivate(makeContext(UserRole.OWNER))).toBe(true);
  });

  it('allows ADMIN to create/update/delete exceptions', () => {
    expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
  });

  it('forbids STAFF from mutate endpoints', () => {
    expect(() => guard.canActivate(makeContext(UserRole.STAFF))).toThrow(
      ForbiddenException,
    );
  });

  it('forbids CUSTOMER from mutate endpoints', () => {
    expect(() => guard.canActivate(makeContext(UserRole.CUSTOMER))).toThrow(
      ForbiddenException,
    );
  });

  it('allows STAFF on read endpoints when Roles include STAFF', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(guard.canActivate(makeContext(UserRole.STAFF))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });
});
