import { Injectable, NotFoundException } from '@nestjs/common';
import { AppLogger } from '../common/logger/app-logger.service';
import { AuthUser } from '../common/types/authenticated-request';
import { OrganizationService } from '../organization/organization.service';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { User } from '../user/entities/user.entity';
import { DEFAULT_ORG_SLUG, UserService } from '../user/user.service';
import { AuthUserDto } from './dto/auth-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
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
    private readonly organizations: OrganizationService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    this.logger.debug(`Login attempt for ${dto.email}`);

    const organization = await this.organizations.findBySlug(DEFAULT_ORG_SLUG);
    if (!organization) {
      this.logger.error(`Default organization '${DEFAULT_ORG_SLUG}' is missing`);
      throw new NotFoundException(
        `Default organization '${DEFAULT_ORG_SLUG}' not found`,
      );
    }

    const candidates = await this.users.findLoginCandidates(
      dto.email,
      organization.id,
    );
    const matches = await this.matchPassword(candidates, dto.password);

    if (matches.length === 0) {
      this.logger.warn(`Failed login for ${dto.email}`);
      throw new InvalidCredentialsException();
    }
    if (matches.length > 1) {
      throw new AmbiguousAccountException(matches);
    }

    const [user] = matches;
    this.logger.log(
      `User signed in: ${user.email} (role=${user.role}, id=${user.id})`,
    );

    return {
      user: AuthUserDto.fromEntity(user),
      session: await this.sessions.issue(user.id, client),
    };
  }

  async registerUser(dto: RegisterUserDto): Promise<UserResponseDto> {
    this.logger.log(
      `Registering user ${dto.email} with role ${dto.role} into ${DEFAULT_ORG_SLUG}`,
    );

    const organization = await this.organizations.findBySlug(DEFAULT_ORG_SLUG);
    if (!organization) {
      this.logger.error(`Default organization '${DEFAULT_ORG_SLUG}' is missing`);
      throw new NotFoundException(
        `Default organization '${DEFAULT_ORG_SLUG}' not found`,
      );
    }

    const created = await this.users.registerInDefaultOrg({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      organizationId: organization.id,
    });

    this.logger.log(`User registered: ${created.email} (${created.id})`);
    return created;
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
