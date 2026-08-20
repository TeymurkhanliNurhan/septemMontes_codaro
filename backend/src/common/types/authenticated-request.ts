import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
  query: Record<string, string | string[] | undefined>;
}
