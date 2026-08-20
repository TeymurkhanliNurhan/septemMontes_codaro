import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  formatTimeHhMm,
  isEndAfterStart,
  timesOverlap,
} from '../common/utils/time';
import { ResourceService } from '../resource/resource.service';
import { AvailabilityRule } from './entities/availability-rule.entity';
import { CreateAvailabilityRuleDto } from './dto/create-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-rule.dto';
import {
  AvailabilityRuleActiveStatusResponseDto,
  AvailabilityRuleListResponseDto,
  AvailabilityRuleResponseDto,
} from './dto/rule-response.dto';

@Injectable()
export class AvailabilityRuleService {
  constructor(
    @InjectRepository(AvailabilityRule)
    private readonly repo: Repository<AvailabilityRule>,
    private readonly resourceService: ResourceService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    resourceId: string,
    organizationId: string,
  ): Promise<AvailabilityRuleListResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );

    const items = await this.repo.find({
      where: { resourceId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    return { data: items.map((item) => this.toDto(item)) };
  }

  async findOne(
    resourceId: string,
    ruleId: string,
    organizationId: string,
  ): Promise<AvailabilityRuleResponseDto> {
    const item = await this.findRuleForResource(
      resourceId,
      ruleId,
      organizationId,
    );
    return this.toDto(item);
  }

  async create(
    resourceId: string,
    dto: CreateAvailabilityRuleDto,
    organizationId: string,
  ): Promise<AvailabilityRuleResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );
    this.assertValidTimeRange(dto.startTime, dto.endTime);

    return this.dataSource.transaction(async (manager) => {
      await this.assertNoActiveOverlap(
        manager,
        resourceId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
      );

      const entity = manager.create(AvailabilityRule, {
        resourceId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone ?? null,
        isActive: true,
        metadata: dto.metadata ?? {},
      });
      const saved = await manager.save(entity);
      return this.toDto(saved);
    });
  }

  async update(
    resourceId: string,
    ruleId: string,
    dto: UpdateAvailabilityRuleDto,
    organizationId: string,
  ): Promise<AvailabilityRuleResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );

    return this.dataSource.transaction(async (manager) => {
      const entity = await this.findRuleLocked(
        manager,
        resourceId,
        ruleId,
      );

      if (dto.dayOfWeek !== undefined) {
        entity.dayOfWeek = dto.dayOfWeek;
      }
      if (dto.startTime !== undefined) {
        entity.startTime = dto.startTime;
      }
      if (dto.endTime !== undefined) {
        entity.endTime = dto.endTime;
      }
      if (dto.timezone !== undefined) {
        entity.timezone = dto.timezone;
      }
      if (dto.isActive !== undefined) {
        entity.isActive = dto.isActive;
      }
      if (dto.metadata !== undefined) {
        entity.metadata = dto.metadata;
      }

      this.assertValidTimeRange(entity.startTime, entity.endTime);

      if (entity.isActive) {
        await this.assertNoActiveOverlap(
          manager,
          resourceId,
          entity.dayOfWeek,
          formatTimeHhMm(entity.startTime),
          formatTimeHhMm(entity.endTime),
          entity.id,
        );
      }

      const saved = await manager.save(entity);
      return this.toDto(saved);
    });
  }

  async activate(
    resourceId: string,
    ruleId: string,
    organizationId: string,
  ): Promise<AvailabilityRuleActiveStatusResponseDto> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );

    return this.dataSource.transaction(async (manager) => {
      const entity = await this.findRuleLocked(
        manager,
        resourceId,
        ruleId,
      );

      await this.assertNoActiveOverlap(
        manager,
        resourceId,
        entity.dayOfWeek,
        formatTimeHhMm(entity.startTime),
        formatTimeHhMm(entity.endTime),
        entity.id,
      );

      entity.isActive = true;
      const saved = await manager.save(entity);
      return { id: saved.id, isActive: saved.isActive };
    });
  }

  async deactivate(
    resourceId: string,
    ruleId: string,
    organizationId: string,
  ): Promise<AvailabilityRuleActiveStatusResponseDto> {
    const entity = await this.findRuleForResource(
      resourceId,
      ruleId,
      organizationId,
    );
    entity.isActive = false;
    const saved = await this.repo.save(entity);
    return { id: saved.id, isActive: saved.isActive };
  }

  async remove(
    resourceId: string,
    ruleId: string,
    organizationId: string,
  ): Promise<void> {
    const entity = await this.findRuleForResource(
      resourceId,
      ruleId,
      organizationId,
    );
    await this.repo.delete(entity.id);
  }

  private async findRuleForResource(
    resourceId: string,
    ruleId: string,
    organizationId: string,
  ): Promise<AvailabilityRule> {
    await this.resourceService.findResourceForOrganization(
      resourceId,
      organizationId,
    );
    const item = await this.repo.findOne({
      where: { id: ruleId, resourceId },
    });
    if (!item) {
      throw new NotFoundException(`AvailabilityRule ${ruleId} not found`);
    }
    return item;
  }

  private async findRuleLocked(
    manager: EntityManager,
    resourceId: string,
    ruleId: string,
  ): Promise<AvailabilityRule> {
    const item = await manager.findOne(AvailabilityRule, {
      where: { id: ruleId, resourceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) {
      throw new NotFoundException(`AvailabilityRule ${ruleId} not found`);
    }
    return item;
  }

  private async assertNoActiveOverlap(
    manager: EntityManager,
    resourceId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeRuleId?: string,
  ): Promise<void> {
    const qb = manager
      .getRepository(AvailabilityRule)
      .createQueryBuilder('rule')
      .setLock('pessimistic_write')
      .where('rule.resourceId = :resourceId', { resourceId })
      .andWhere('rule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('rule.isActive = true');

    if (excludeRuleId) {
      qb.andWhere('rule.id != :excludeRuleId', { excludeRuleId });
    }

    const existing = await qb.getMany();
    const overlaps = existing.some((rule) =>
      timesOverlap(
        startTime,
        endTime,
        formatTimeHhMm(rule.startTime),
        formatTimeHhMm(rule.endTime),
      ),
    );

    if (overlaps) {
      throw new ConflictException(
        'Availability rule overlaps an existing active rule for this day',
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

  private toDto(entity: AvailabilityRule): AvailabilityRuleResponseDto {
    return {
      id: entity.id,
      resourceId: entity.resourceId,
      dayOfWeek: entity.dayOfWeek,
      startTime: formatTimeHhMm(entity.startTime),
      endTime: formatTimeHhMm(entity.endTime),
      timezone: entity.timezone,
      isActive: entity.isActive,
      metadata: entity.metadata ?? {},
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
