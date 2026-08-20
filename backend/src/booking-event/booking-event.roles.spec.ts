import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';

describe('Booking events RBAC (RolesGuard)', () => {
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

  it('allows OWNER to read booking events', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(guard.canActivate(makeContext(UserRole.OWNER))).toBe(true);
  });

  it('allows ADMIN to read booking events', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
  });

  it('allows STAFF to read booking events', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(guard.canActivate(makeContext(UserRole.STAFF))).toBe(true);
  });

  it('forbids CUSTOMER from reading booking events', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
    expect(() => guard.canActivate(makeContext(UserRole.CUSTOMER))).toThrow(
      ForbiddenException,
    );
  });

  it('does not expose public arbitrary event creation roles on append-only API', () => {
    // Public create was removed; mutate roles are not defined for booking-events.
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
  });
});
