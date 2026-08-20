import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  formatDateYmd,
  formatTimeHhMm,
  isEndAfterStart,
  timesOverlap,
} from '../common/utils/time';
import { ResourceService } from '../resource/resource.service';
import { AvailabilityException } from './entities/availability-exception.entity';
import { CreateAvailabilityExceptionDto } from './dto/create-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-exception.dto';
import { AvailabilityExceptionListQueryDto } from './dto/exception-list-query.dto';
import {
  AvailabilityExceptionListResponseDto,
  AvailabilityExceptionResponseDto,
} from './dto/exception-response.dto';

@Injectable()
export class AvailabilityExceptionService {
  constructor(
    @InjectRepository(AvailabilityException)
    private readonly repo: Repository<AvailabilityException>,
    private readonly resourceService: ResourceService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    resourceId: string,
    organizationId: string,
    query: AvailabilityExceptionListQueryDto,
  ): Promise<AvailabilityExceptionListResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );

    const qb = this.repo
      .createQueryBuilder('exception')
      .where('exception.resourceId = :resourceId', { resourceId });

    if (query.from) {
      qb.andWhere('exception.exceptionDate >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('exception.exceptionDate <= :to', { to: query.to });
    }
    if (query.exceptionType) {
      qb.andWhere('exception.exceptionType = :exceptionType', {
        exceptionType: query.exceptionType,
      });
    }

    qb.orderBy('exception.exceptionDate', 'ASC').addOrderBy(
      'exception.startTime',
      'ASC',
    );

    const items = await qb.getMany();
    return { data: items.map((item) => this.toDto(item)) };
  }

  async findOne(
    resourceId: string,
    exceptionId: string,
    organizationId: string,
  ): Promise<AvailabilityExceptionResponseDto> {
    const item = await this.findExceptionForResource(
      resourceId,
      exceptionId,
      organizationId,
    );
    return this.toDto(item);
  }

  async create(
    resourceId: string,
    dto: CreateAvailabilityExceptionDto,
    organizationId: string,
  ): Promise<AvailabilityExceptionResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );
    this.assertValidTimeRange(dto.startTime, dto.endTime);

    return this.dataSource.transaction(async (manager) => {
      await this.assertNoOverlap(
        manager,
        resourceId,
        dto.exceptionDate,
        dto.startTime,
        dto.endTime,
      );

      const entity = manager.create(AvailabilityException, {
        resourceId,
        exceptionDate: dto.exceptionDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        exceptionType: dto.exceptionType,
        reason: dto.reason ?? null,
        metadata: dto.metadata ?? {},
      });
      const saved = await manager.save(entity);
      return this.toDto(saved);
    });
  }

  async update(
    resourceId: string,
    exceptionId: string,
    dto: UpdateAvailabilityExceptionDto,
    organizationId: string,
  ): Promise<AvailabilityExceptionResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );

    return this.dataSource.transaction(async (manager) => {
      const entity = await this.findExceptionLocked(
        manager,
        resourceId,
        exceptionId,
      );

      if (dto.exceptionDate !== undefined) {
        entity.exceptionDate = dto.exceptionDate;
      }
      if (dto.startTime !== undefined) {
        entity.startTime = dto.startTime;
      }
      if (dto.endTime !== undefined) {
        entity.endTime = dto.endTime;
      }
      if (dto.exceptionType !== undefined) {
        entity.exceptionType = dto.exceptionType;
      }
      if (dto.reason !== undefined) {
        entity.reason = dto.reason;
      }
      if (dto.metadata !== undefined) {
        entity.metadata = dto.metadata;
      }

      const exceptionDate = formatDateYmd(entity.exceptionDate);
      const startTime = formatTimeHhMm(entity.startTime);
      const endTime = formatTimeHhMm(entity.endTime);
      this.assertValidTimeRange(startTime, endTime);

      await this.assertNoOverlap(
        manager,
        resourceId,
        exceptionDate,
        startTime,
        endTime,
        entity.id,
      );

      const saved = await manager.save(entity);
      return this.toDto(saved);
    });
  }

  async remove(
    resourceId: string,
    exceptionId: string,
    organizationId: string,
  ): Promise<void> {
    const entity = await this.findExceptionForResource(
      resourceId,
      exceptionId,
      organizationId,
    );
    await this.repo.delete(entity.id);
  }

  private async findExceptionForResource(
    resourceId: string,
    exceptionId: string,
    organizationId: string,
  ): Promise<AvailabilityException> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );
    const item = await this.repo.findOne({
      where: { id: exceptionId, resourceId },
    });
    if (!item) {
      throw new NotFoundException(
        `AvailabilityException ${exceptionId} not found`,
      );
    }
    return item;
  }

  private async findExceptionLocked(
    manager: EntityManager,
    resourceId: string,
    exceptionId: string,
  ): Promise<AvailabilityException> {
    const item = await manager.findOne(AvailabilityException, {
      where: { id: exceptionId, resourceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) {
      throw new NotFoundException(
        `AvailabilityException ${exceptionId} not found`,
      );
    }
    return item;
  }

  private async assertNoOverlap(
    manager: EntityManager,
    resourceId: string,
    exceptionDate: string,
    startTime: string,
    endTime: string,
    excludeExceptionId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(AvailabilityException)
      .createQueryBuilder('exception')
      .setLock('pessimistic_write')
      .where('exception.resourceId = :resourceId', { resourceId })
      .andWhere('exception.exceptionDate = :exceptionDate', {
        exceptionDate,
      });

    if (excludeExceptionId) {
      qb.andWhere('exception.id != :excludeExceptionId', {
        excludeExceptionId,
      });
    }

    const existing = await qb.getMany();
    const overlaps = existing.some((exception) =>
      timesOverlap(
        startTime,
        endTime,
        formatTimeHhMm(exception.startTime),
        formatTimeHhMm(exception.endTime),
      ),
    );

    if (overlaps) {
      throw new ConflictException(
        'Availability exception overlaps an existing exception for this date',
      );
    }
  }

  private assertValidTimeRange(startTime: string, endTime: string): void {
    const start = formatTimeHhMm(startTime);
    const end = formatTimeHhMm(endTime);
    if (!isEndAfterStart(start, end)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private toDto(
    entity: AvailabilityException,
  ): AvailabilityExceptionResponseDto {
    return {
      id: entity.id,
      resourceId: entity.resourceId,
      exceptionDate: formatDateYmd(entity.exceptionDate),
      startTime: formatTimeHhMm(entity.startTime),
      endTime: formatTimeHhMm(entity.endTime),
      exceptionType: entity.exceptionType,
      reason: entity.reason,
      metadata: entity.metadata ?? {},
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
