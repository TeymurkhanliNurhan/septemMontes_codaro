import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './entities/resource.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly repo: Repository<Resource>,
  ) {}

  async findByOrganization(
    organizationId: string,
  ): Promise<ResourceResponseDto[]> {
    const items = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<ResourceResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Resource ' + id + ' not found');
    return this.toDto(item);
  }

  async create(
    dto: CreateResourceDto,
    organizationId?: string,
  ): Promise<ResourceResponseDto> {
    const orgId = dto.organizationId ?? organizationId;
    const entity = this.repo.create({
      ...dto,
      organizationId: orgId,
      organizationsId: dto.organizationsId ?? orgId,
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateResourceDto): Promise<ResourceResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity)
      throw new NotFoundException('Resource ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException('Resource ' + id + ' not found');
  }

  private toDto(entity: Resource): ResourceResponseDto {
    return entity;
  }
}
