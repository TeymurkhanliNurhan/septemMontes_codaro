import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceStatus } from '../common/enums/resource-status.enum';
import { BookingResource } from '../booking-resource/entities/booking-resource.entity';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { Resource } from './entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceListQueryDto } from './dto/resource-list-query.dto';
import {
  ResourceLinkedServiceDto,
  ResourceLinkedServiceListResponseDto,
  ResourceListResponseDto,
  ResourceResponseDto,
} from './dto/resource-response.dto';

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly repo: Repository<Resource>,
    @InjectRepository(BookingResource)
    private readonly bookingResourceRepo: Repository<BookingResource>,
    @InjectRepository(ServiceResource)
    private readonly serviceResourceRepo: Repository<ServiceResource>,
  ) {}

  async findAll(
    organizationId: string,
    query: ResourceListQueryDto,
  ): Promise<ResourceListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = (query.sortOrder ?? 'desc').toUpperCase() as
      | 'ASC'
      | 'DESC';

    const qb = this.repo
      .createQueryBuilder('resource')
      .where('resource.organizationId = :organizationId', { organizationId });

    if (query.search?.trim()) {
      qb.andWhere('LOWER(resource.name) LIKE LOWER(:search)', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.resourceType) {
      qb.andWhere('resource.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.status) {
      qb.andWhere('resource.status = :status', { status: query.status });
    }

    qb.orderBy(`resource.${sortBy}`, sortOrder)
      .addOrderBy('resource.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((item) => this.toDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<ResourceResponseDto> {
    const item = await this.findResourceForOrganization(id, organizationId);
    return this.toDto(item);
  }

  async create(
    dto: CreateResourceDto,
    organizationId: string,
  ): Promise<ResourceResponseDto> {
    this.requireOrganizationId(organizationId);

    const entity = this.repo.create({
      name: dto.name,
      resourceType: dto.resourceType ?? null,
      metadata: dto.metadata ?? {},
      status: ResourceStatus.ACTIVE,
      organizationId,
      organizationsId: organizationId,
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(
    id: string,
    dto: UpdateResourceDto,
    organizationId: string,
  ): Promise<ResourceResponseDto> {
    const entity = await this.findResourceForOrganization(id, organizationId);

    if (dto.name !== undefined) {
      entity.name = dto.name;
    }
    if (dto.resourceType !== undefined) {
      entity.resourceType = dto.resourceType;
    }
    if (dto.status !== undefined) {
      entity.status = dto.status;
    }
    if (dto.metadata !== undefined) {
      entity.metadata = dto.metadata;
    }

    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const entity = await this.findResourceForOrganization(id, organizationId);

    const bookingLinks = await this.bookingResourceRepo.count({
      where: { resourceId: entity.id },
    });
    if (bookingLinks > 0) {
      throw new ConflictException(
        'Resource cannot be deleted because it is linked to bookings. Deactivate it instead.',
      );
    }

    await this.repo.delete(entity.id);
  }

  async listServices(
    resourceId: string,
    organizationId: string,
  ): Promise<ResourceLinkedServiceListResponseDto> {
    await this.findResourceForOrganization(resourceId, organizationId);

    const links = await this.serviceResourceRepo.find({
      where: { resourceId },
      relations: { service: true },
    });

    const data: ResourceLinkedServiceDto[] = links
      .filter((link) => link.service?.organizationId === organizationId)
      .map((link) => ({
        id: link.service.id,
        name: link.service.name,
        durationMinutes: link.service.durationMinutes,
        isActive: link.service.isActive,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { data };
  }

  /**
   * Ensures a resource is ACTIVE and belongs to the organization before
   * attaching it to a new booking. Historical booking links are unaffected.
   */
  async assertUsableForNewBooking(
    resourceId: string,
    organizationId?: string,
  ): Promise<Resource> {
    const where = organizationId
      ? { id: resourceId, organizationId }
      : { id: resourceId };
    const resource = await this.repo.findOne({ where });
    if (!resource) {
      throw new NotFoundException(`Resource ${resourceId} not found`);
    }
    if (resource.status !== ResourceStatus.ACTIVE) {
      throw new BadRequestException(
        'Inactive resources cannot be used for new bookings',
      );
    }
    return resource;
  }

  async findResourceForOrganization(
    id: string,
    organizationId: string,
  ): Promise<Resource> {
    this.requireOrganizationId(organizationId);
    const item = await this.repo.findOne({
      where: { id, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Resource ${id} not found`);
    }
    return item;
  }

  private requireOrganizationId(organizationId: string): void {
    if (!organizationId) {
      throw new BadRequestException(
        'Authenticated user is missing organization context',
      );
    }
  }

  private toDto(entity: Resource): ResourceResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      resourceType: entity.resourceType,
      status: entity.status,
      metadata: entity.metadata ?? {},
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
