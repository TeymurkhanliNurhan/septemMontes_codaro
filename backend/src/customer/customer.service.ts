import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  async findByOrganization(
    organizationId: string,
  ): Promise<CustomerResponseDto[]> {
    const items = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<CustomerResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Customer ' + id + ' not found');
    return this.toDto(item);
  }

  async create(
    dto: CreateCustomerDto,
    organizationId?: string,
    createdByUserId?: string,
  ): Promise<CustomerResponseDto> {
    const entity = this.repo.create({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
      ...(createdByUserId && { createdByUserId }),
    } as Partial<Customer>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity)
      throw new NotFoundException('Customer ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException('Customer ' + id + ' not found');
  }

  private toDto(entity: Customer): CustomerResponseDto {
    return entity;
  }
}
