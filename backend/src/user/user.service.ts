import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByOrganization(organizationId: string): Promise<UserResponseDto[]> {
    const items = await this.userRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string, organizationId?: string): Promise<UserResponseDto> {
    const item = await this.userRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (organizationId && item.organizationId !== organizationId) {
      throw new ForbiddenException('User belongs to another organization');
    }
    return this.toDto(item);
  }

  async findByEmail(
    organizationId: string,
    email: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({ where: { organizationId, email } });
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const entity = this.userRepository.create({
      organizationId: dto.organizationId,
      name: dto.name,
      email: dto.email,
      role: dto.role ?? UserRole.STAFF,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.userRepository.save(entity);
    return this.toDto(saved);
  }

  async update(
    dto: UpdateUserDto,
    organizationId?: string,
  ): Promise<UserResponseDto> {
    const entity = await this.userRepository.findOne({
      where: { id: dto.id },
    });
    if (!entity) {
      throw new NotFoundException(`User ${dto.id} not found`);
    }
    if (organizationId && entity.organizationId !== organizationId) {
      throw new ForbiddenException('User belongs to another organization');
    }
    Object.assign(entity, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    const saved = await this.userRepository.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string, organizationId?: string): Promise<void> {
    const entity = await this.userRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`User ${id} not found`);
    }
    if (organizationId && entity.organizationId !== organizationId) {
      throw new ForbiddenException('User belongs to another organization');
    }
    await this.userRepository.delete(id);
  }

  private toDto(entity: User): UserResponseDto {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      name: entity.name,
      email: entity.email,
      role: entity.role,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
