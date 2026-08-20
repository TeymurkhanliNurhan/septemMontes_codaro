import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  canAssignRole,
  canManage,
} from '../common/authorization/role-hierarchy';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/types/authenticated-request';
import { User } from './entities/user.entity';

@Injectable()
export class UserAccessPolicy {
  assertCanAssignRole(actor: AuthUser, role: UserRole): void {
    if (!canAssignRole(actor.role, role)) {
      throw new ForbiddenException(
        `You cannot grant a role above your own (${actor.role})`,
      );
    }
  }

  assertCanManage(actor: AuthUser, target: User): void {
    if (!canManage(actor.role, target.role)) {
      throw new ForbiddenException(
        `You cannot modify a user with the ${target.role} role`,
      );
    }
  }

  assertNotSelfRoleChange(actor: AuthUser, target: User): void {
    if (actor.userId === target.id) {
      throw new ForbiddenException('You cannot change your own role');
    }
  }

  assertNotSelfDeletion(actor: AuthUser, target: User): void {
    if (actor.userId === target.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
  }
}
