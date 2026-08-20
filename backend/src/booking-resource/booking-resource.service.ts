import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceService } from '../resource/resource.service';
import { BookingResource } from './entities/booking-resource.entity';
import { CreateBookingResourceDto } from './dto/create-booking-resource.dto';
import { BookingResourceResponseDto } from './dto/booking-resource-response.dto';

@Injectable()
export class BookingResourceService {
  constructor(
    @InjectRepository(BookingResource)
    private readonly repo: Repository<BookingResource>,
    private readonly resourceService: ResourceService,
  ) {}

  async findAll(
    filter?: Partial<CreateBookingResourceDto>,
  ): Promise<BookingResourceResponseDto[]> {
    const items = await this.repo.find({ where: filter as object });
    return items;
  }

  async create(
    dto: CreateBookingResourceDto,
  ): Promise<BookingResourceResponseDto> {
    await this.resourceService.assertUsableForNewBooking(dto.resourceId);
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async remove(bookingId: string, resourceId: string): Promise<void> {
    const result = await this.repo.delete({ bookingId, resourceId });
    if (!result.affected) throw new NotFoundException('Link not found');
  }
}
