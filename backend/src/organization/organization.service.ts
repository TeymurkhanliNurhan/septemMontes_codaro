import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async findAll(): Promise<OrganizationResponseDto[]> {
    const items = await this.organizationRepository.find({
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<OrganizationResponseDto> {
    const item = await this.organizationRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
    return this.toDto(item);
  }

  async create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const entity = this.organizationRepository.create({
      name: dto.name,
      slug: dto.slug,
      timezone: dto.timezone ?? 'utc',
      metadata: dto.metadata ?? {},
    });
    const saved = await this.organizationRepository.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateOrganizationDto): Promise<OrganizationResponseDto> {
    const entity = await this.organizationRepository.findOne({
      where: { id: dto.id },
    });
    if (!entity) {
      throw new NotFoundException(`Organization ${dto.id} not found`);
    }
    Object.assign(entity, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    const saved = await this.organizationRepository.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.organizationRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
  }

  private toDto(entity: Organization): OrganizationResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      timezone: entity.timezone,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
