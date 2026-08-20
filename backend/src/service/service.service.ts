import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { ResourceService } from '../resource/resource.service';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import {
  ServiceLinkedResourceDto,
  ServiceLinkedResourceListResponseDto,
  ServiceListResponseDto,
  ServiceResponseDto,
} from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
    @InjectRepository(ServiceResource)
    private readonly serviceResourceRepo: Repository<ServiceResource>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly resourceService: ResourceService,
  ) {}

  async query(
    organizationId: string,
    query: ServiceQueryDto,
  ): Promise<
    | ServiceListResponseDto
    | { data: ServiceResponseDto }
    | ServiceLinkedResourceListResponseDto
  > {
    if (query.id && query.include === 'resources') {
      return this.listResources(query.id, organizationId);
    }
    if (query.id) {
      const data = await this.findOne(query.id, organizationId);
      return { data };
    }
    return this.findAll(organizationId, query);
  }

  async findAll(
    organizationId: string,
    query: ServiceQueryDto,
  ): Promise<ServiceListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = (query.sortOrder ?? 'desc').toUpperCase() as
      | 'ASC'
      | 'DESC';

    const qb = this.repo
      .createQueryBuilder('service')
      .where('service.organizationId = :organizationId', { organizationId });

    if (query.search?.trim()) {
      qb.andWhere('LOWER(service.name) LIKE LOWER(:search)', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.status === 'ACTIVE') {
      qb.andWhere('service.isActive = :isActive', { isActive: true });
    } else if (query.status === 'INACTIVE') {
      qb.andWhere('service.isActive = :isActive', { isActive: false });
    }

    qb.orderBy(`service.${sortBy}`, sortOrder)
      .addOrderBy('service.id', 'ASC')
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
  ): Promise<ServiceResponseDto> {
    const item = await this.findServiceForOrganization(id, organizationId);
    return this.toDto(item);
  }

  async create(
    dto: CreateServiceDto,
    organizationId: string,
  ): Promise<ServiceResponseDto> {
    this.requireOrganizationId(organizationId);

    const entity = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      durationMinutes: dto.durationMinutes,
      bufferBeforeMinutes: dto.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: dto.bufferAfterMinutes ?? 0,
      metadata: dto.metadata ?? {},
      isActive: true,
      organizationId,
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(
    dto: UpdateServiceDto,
    organizationId: string,
  ): Promise<ServiceResponseDto> {
    const entity = await this.findServiceForOrganization(dto.id, organizationId);

    if (dto.name !== undefined) {
      entity.name = dto.name;
    }
    if (dto.description !== undefined) {
      entity.description = dto.description;
    }
    if (dto.durationMinutes !== undefined) {
      entity.durationMinutes = dto.durationMinutes;
    }
    if (dto.bufferBeforeMinutes !== undefined) {
      entity.bufferBeforeMinutes = dto.bufferBeforeMinutes;
    }
    if (dto.bufferAfterMinutes !== undefined) {
      entity.bufferAfterMinutes = dto.bufferAfterMinutes;
    }
    if (dto.isActive !== undefined) {
      entity.isActive = dto.isActive;
    }
    if (dto.metadata !== undefined) {
      entity.metadata = dto.metadata;
    }

    const saved = await this.repo.save(entity);

    if (dto.resourceIds !== undefined) {
      await this.replaceResourceLinks(
        saved.id,
        dto.resourceIds,
        organizationId,
      );
    }

    return this.toDto(saved);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const entity = await this.findServiceForOrganization(id, organizationId);

    const bookingLinks = await this.bookingRepo.count({
      where: { serviceId: entity.id },
    });
    if (bookingLinks > 0) {
      throw new ConflictException(
        'Service cannot be deleted because it is linked to bookings. Deactivate it instead.',
      );
    }

    await this.repo.delete(entity.id);
  }

  async listResources(
    serviceId: string,
    organizationId: string,
  ): Promise<ServiceLinkedResourceListResponseDto> {
    await this.findServiceForOrganization(serviceId, organizationId);

    const links = await this.serviceResourceRepo.find({
      where: { serviceId },
      relations: { resource: true },
      order: { resourceId: 'ASC' },
    });

    const data: ServiceLinkedResourceDto[] = links
      .filter((link) => link.resource?.organizationId === organizationId)
      .map((link) => ({
        id: link.resource.id,
        name: link.resource.name,
        resourceType: link.resource.resourceType,
        status: link.resource.status,
      }));

    return { data };
  }

  /**
   * Ensures a service is ACTIVE and belongs to the organization before
   * using it for a new booking. Historical bookings are unaffected.
   */
  async assertUsableForNewBooking(
    serviceId: string,
    organizationId?: string,
  ): Promise<Service> {
    const where = organizationId
      ? { id: serviceId, organizationId }
      : { id: serviceId };
    const service = await this.repo.findOne({ where });
    if (!service) {
      throw new NotFoundException(`Service ${serviceId} not found`);
    }
    if (!service.isActive) {
      throw new BadRequestException(
        'Inactive services cannot be used for new bookings',
      );
    }
    return service;
  }

  async findServiceForOrganization(
    id: string,
    organizationId: string,
  ): Promise<Service> {
    this.requireOrganizationId(organizationId);
    const item = await this.repo.findOne({
      where: { id, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Service ${id} not found`);
    }
    return item;
  }

  private async replaceResourceLinks(
    serviceId: string,
    resourceIds: string[],
    organizationId: string,
  ): Promise<void> {
    const uniqueIds = [...new Set(resourceIds)];

    for (const resourceId of uniqueIds) {
      await this.resourceService.findResourceForOrganization(
        resourceId,
        organizationId,
      );
    }

    const existing = await this.serviceResourceRepo.find({
      where: { serviceId },
    });
    const existingIds = new Set(existing.map((link) => link.resourceId));
    const nextIds = new Set(uniqueIds);

    const toRemove = existing.filter((link) => !nextIds.has(link.resourceId));
    if (toRemove.length > 0) {
      await this.serviceResourceRepo.delete({
        serviceId,
        resourceId: In(toRemove.map((link) => link.resourceId)),
      });
    }

    const toAdd = uniqueIds.filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const links = toAdd.map((resourceId) =>
        this.serviceResourceRepo.create({ serviceId, resourceId }),
      );
      await this.serviceResourceRepo.save(links);
    }
  }

  private requireOrganizationId(organizationId: string): void {
    if (!organizationId) {
      throw new BadRequestException(
        'Authenticated user is missing organization context',
      );
    }
  }

  private toDto(entity: Service): ServiceResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      durationMinutes: entity.durationMinutes,
      bufferBeforeMinutes: entity.bufferBeforeMinutes,
      bufferAfterMinutes: entity.bufferAfterMinutes,
      isActive: entity.isActive,
      metadata: entity.metadata ?? {},
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
