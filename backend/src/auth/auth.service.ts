import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/authenticated-request';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthUserDto } from './dto/auth-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SessionDto } from './dto/session.dto';
import { AmbiguousAccountException } from './exceptions/ambiguous-account.exception';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { SessionNotFoundException } from './exceptions/session-not-found.exception';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { ClientInfo } from './types/client-info';
import { IssuedSession } from './types/session-tokens';

export interface LoginResult {
  user: AuthUserDto;
  session: IssuedSession;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
  ) {}

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    const candidates = await this.users.findLoginCandidates(
      dto.email,
      dto.organizationId,
    );
    const matches = await this.matchPassword(candidates, dto.password);

    if (matches.length === 0) {
      throw new InvalidCredentialsException();
    }
    if (matches.length > 1) {
      throw new AmbiguousAccountException(matches);
    }

    const [user] = matches;

    return {
      user: AuthUserDto.fromEntity(user),
      session: await this.sessions.issue(user.id, client),
    };
  }

  me(user: AuthUser): AuthUserDto {
    return AuthUserDto.fromAuthUser(user);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  logoutAll(user: AuthUser): Promise<number> {
    return this.sessions.revokeAllForUser(user.userId);
  }

  async listSessions(user: AuthUser): Promise<SessionDto[]> {
    const sessions = await this.sessions.listActiveForUser(user.userId);
    return sessions.map((session) =>
      SessionDto.fromEntity(session, user.sessionId),
    );
  }

  async revokeSession(user: AuthUser, sessionId: string): Promise<void> {
    const session = await this.sessions.findOwned(sessionId, user.userId);
    if (!session) {
      throw new SessionNotFoundException();
    }
    await this.sessions.revoke(session.id);
  }

  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<number> {
    await this.assertCurrentPassword(user.userId, dto.currentPassword);
    await this.users.setPassword(user.userId, dto.newPassword);

    if (dto.revokeOtherSessions === false) {
      return 0;
    }
    return this.sessions.revokeAllForUser(user.userId, user.sessionId);
  }

  private async matchPassword(
    candidates: User[],
    password: string,
  ): Promise<User[]> {
    if (candidates.length === 0) {
      await this.passwords.verify(password, null);
      return [];
    }

    const outcomes = await Promise.all(
      candidates.map((candidate) =>
        this.passwords.verify(password, candidate.passwordHash),
      ),
    );

    return candidates.filter((_candidate, index) => outcomes[index]);
  }

  private async assertCurrentPassword(
    userId: string,
    password: string,
  ): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);
    const matches =
      user !== null &&
      (await this.passwords.verify(password, user.passwordHash));

    if (!matches) {
      throw new InvalidCredentialsException('Current password is incorrect');
    }
  }
}
