import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../user/entities/user.entity';

export interface AccessTokenPayload {
  sub: string;
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId: string;
}

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId,
    };

    return this.jwt.signAsync(payload);
  }

  verify(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token);
  }
}
