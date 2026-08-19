import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityRule } from './entities/availability-rule.entity';
import { CreateAvailabilityRuleDto } from './dto/create-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-rule.dto';
import { AvailabilityRuleResponseDto } from './dto/rule-response.dto';

@Injectable()
export class AvailabilityRuleService {
  constructor(
    @InjectRepository(AvailabilityRule)
    private readonly repo: Repository<AvailabilityRule>,
  ) {}

  async findByFilter(resourceId: string): Promise<AvailabilityRuleResponseDto[]> {
    const items = await this.repo.find({ where: { resourceId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findAll(): Promise<AvailabilityRuleResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<AvailabilityRuleResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('AvailabilityRule ' + id + ' not found');
    return this.toDto(item);
  }

  async create(dto: CreateAvailabilityRuleDto): Promise<AvailabilityRuleResponseDto> {
    const entity = this.repo.create(dto as Partial<AvailabilityRule>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateAvailabilityRuleDto): Promise<AvailabilityRuleResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('AvailabilityRule ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('AvailabilityRule ' + id + ' not found');
  }

  private toDto(entity: AvailabilityRule): AvailabilityRuleResponseDto {
    return entity as unknown as AvailabilityRuleResponseDto;
  }
}
