import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceResource } from './entities/service-resource.entity';
import { CreateServiceResourceDto } from './dto/create-service-resource.dto';
import { ServiceResourceResponseDto } from './dto/service-resource-response.dto';

@Injectable()
export class ServiceResourceService {
  constructor(
    @InjectRepository(ServiceResource)
    private readonly repo: Repository<ServiceResource>,
  ) {}

  async findAll(filter?: Partial<CreateServiceResourceDto>): Promise<ServiceResourceResponseDto[]> {
    const items = await this.repo.find({ where: filter as object });
    return items as ServiceResourceResponseDto[];
  }

  async create(dto: CreateServiceResourceDto): Promise<ServiceResourceResponseDto> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async remove(serviceId: string, resourceId: string): Promise<void> {
    const result = await this.repo.delete({ serviceId, resourceId });
    if (!result.affected) throw new NotFoundException('Link not found');
  }
}
