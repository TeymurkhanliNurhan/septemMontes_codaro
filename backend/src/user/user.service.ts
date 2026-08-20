import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PasswordService } from '../auth/services/password.service';
import { SessionService } from '../auth/services/session.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/types/authenticated-request';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { UserAccessPolicy } from './user-access.policy';

export const DEFAULT_ORG_SLUG = 'septem_montes';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly policy: UserAccessPolicy,
  ) {}

  async findByOrganization(organizationId: string): Promise<UserResponseDto[]> {
    const users = await this.baseQuery()
      .where('user.organizationId = :organizationId', { organizationId })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return users.map((user) => UserResponseDto.fromEntity(user));
  }

  async findOne(id: string, organizationId: string): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(
      await this.findInOrganization(id, organizationId),
    );
  }

  findLoginCandidates(email: string, organizationId?: string): Promise<User[]> {
    const query = this.baseQuery()
      .leftJoinAndSelect('user.organization', 'organization')
      .where('LOWER(user.email) = LOWER(:email)', { email });

    if (organizationId) {
      query.andWhere('user.organizationId = :organizationId', {
        organizationId,
      });
    }

    return query.getMany();
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.baseQuery().where('user.id = :id', { id }).getOne();
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.users.update(id, {
      passwordHash: await this.passwords.hash(password),
    });
  }

  async registerInDefaultOrg(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    organizationId: string;
  }): Promise<UserResponseDto> {
    const email = normalizeEmail(input.email);
    const existing = await this.users.findOne({
      where: { organizationId: input.organizationId, email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.users.save(
      this.users.create({
        organizationId: input.organizationId,
        name: input.name,
        email,
        role: input.role,
        metadata: {},
        passwordHash: await this.passwords.hash(input.password),
        updatedAt: null,
      }),
    );

    await this.users.update(user.id, { updatedAt: null });
    user.updatedAt = null;
    return UserResponseDto.fromEntity(user);
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserResponseDto> {
    const role = dto.role ?? UserRole.STAFF;
    this.policy.assertCanAssignRole(actor, role);

    const user = await this.users.save(
      this.users.create({
        organizationId: actor.organizationId,
        name: dto.name,
        email: normalizeEmail(dto.email),
        role,
        metadata: dto.metadata ?? {},
        passwordHash: dto.password
          ? await this.passwords.hash(dto.password)
          : null,
        updatedAt: null,
      }),
    );

    await this.users.update(user.id, { updatedAt: null });
    user.updatedAt = null;
    return UserResponseDto.fromEntity(user);
  }

  async update(dto: UpdateUserDto, actor: AuthUser): Promise<UserResponseDto> {
    const user = await this.findInOrganization(dto.id, actor.organizationId);
    this.policy.assertCanManage(actor, user);

    if (dto.role !== undefined && dto.role !== user.role) {
      this.policy.assertNotSelfRoleChange(actor, user);
      this.policy.assertCanAssignRole(actor, dto.role);
    }

    const saved = await this.users.save(await this.applyChanges(user, dto));

    if (dto.password !== undefined) {
      await this.sessions.revokeAllForUser(saved.id);
    }

    return UserResponseDto.fromEntity(saved);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const user = await this.findInOrganization(id, actor.organizationId);
    this.policy.assertNotSelfDeletion(actor, user);
    this.policy.assertCanManage(actor, user);

    await this.users.delete(user.id);
  }

  private async applyChanges(user: User, dto: UpdateUserDto): Promise<User> {
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    if (dto.email !== undefined) {
      user.email = normalizeEmail(dto.email);
    }
    if (dto.role !== undefined) {
      user.role = dto.role;
    }
    if (dto.metadata !== undefined) {
      user.metadata = dto.metadata;
    }
    if (dto.password !== undefined) {
      user.passwordHash = await this.passwords.hash(dto.password);
    }
    user.updatedAt = new Date();
    return user;
  }

  private async findInOrganization(
    id: string,
    organizationId: string,
  ): Promise<User> {
    const user = await this.findByIdWithPassword(id);

    if (!user || user.organizationId !== organizationId) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  private baseQuery(): SelectQueryBuilder<User> {
    return this.users.createQueryBuilder('user').addSelect('user.passwordHash');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
