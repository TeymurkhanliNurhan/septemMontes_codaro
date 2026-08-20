import { UserRole } from '../enums/user-role.enum';

const ROLE_RANK: Readonly<Record<UserRole, number>> = {
  [UserRole.OWNER]: 3,
  [UserRole.ADMIN]: 2,
  [UserRole.STAFF]: 1,
  [UserRole.CUSTOMER]: 0,
};

export function rankOf(role: UserRole): number {
  return ROLE_RANK[role];
}

export function canAssignRole(actor: UserRole, role: UserRole): boolean {
  return rankOf(actor) >= rankOf(role);
}

export function canManage(actor: UserRole, target: UserRole): boolean {
  return rankOf(actor) >= rankOf(target);
}
