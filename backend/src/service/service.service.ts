import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  async findByOrganization(
    organizationId: string,
  ): Promise<ServiceResponseDto[]> {
    const items = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<ServiceResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Service ' + id + ' not found');
    return this.toDto(item);
  }

  async create(
    dto: CreateServiceDto,
    organizationId?: string,
    createdByUserId?: string,
  ): Promise<ServiceResponseDto> {
    const entity = this.repo.create({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
      ...(createdByUserId && { createdByUserId }),
    } as Partial<Service>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateServiceDto): Promise<ServiceResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity)
      throw new NotFoundException('Service ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException('Service ' + id + ' not found');
  }

  private toDto(entity: Service): ServiceResponseDto {
    return entity;
  }
}
