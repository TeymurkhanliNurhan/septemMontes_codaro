import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityException } from './entities/availability-exception.entity';
import { CreateAvailabilityExceptionDto } from './dto/create-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-exception.dto';
import { AvailabilityExceptionResponseDto } from './dto/exception-response.dto';

@Injectable()
export class AvailabilityExceptionService {
  constructor(
    @InjectRepository(AvailabilityException)
    private readonly repo: Repository<AvailabilityException>,
  ) {}

  async findByFilter(resourceId: string): Promise<AvailabilityExceptionResponseDto[]> {
    const items = await this.repo.find({ where: { resourceId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findAll(): Promise<AvailabilityExceptionResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<AvailabilityExceptionResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('AvailabilityException ' + id + ' not found');
    return this.toDto(item);
  }

  async create(dto: CreateAvailabilityExceptionDto): Promise<AvailabilityExceptionResponseDto> {
    const entity = this.repo.create(dto as Partial<AvailabilityException>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateAvailabilityExceptionDto): Promise<AvailabilityExceptionResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('AvailabilityException ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('AvailabilityException ' + id + ' not found');
  }

  private toDto(entity: AvailabilityException): AvailabilityExceptionResponseDto {
    return entity as unknown as AvailabilityExceptionResponseDto;
  }
}
