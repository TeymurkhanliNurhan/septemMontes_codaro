import { UserRole } from '../common/enums/user-role.enum';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      userId: string;
      organizationId: string;
      role: UserRole;
      email: string;
    };
  }
}
