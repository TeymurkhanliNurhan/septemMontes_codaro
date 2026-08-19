import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingEvent } from './entities/booking-event.entity';
import { CreateBookingEventDto } from './dto/create-event.dto';
import { UpdateBookingEventDto } from './dto/update-event.dto';
import { BookingEventResponseDto } from './dto/event-response.dto';

@Injectable()
export class BookingEventService {
  constructor(
    @InjectRepository(BookingEvent)
    private readonly repo: Repository<BookingEvent>,
  ) {}

  async findByFilter(bookingId: string): Promise<BookingEventResponseDto[]> {
    const items = await this.repo.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findAll(): Promise<BookingEventResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<BookingEventResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('BookingEvent ' + id + ' not found');
    return this.toDto(item);
  }

  async create(dto: CreateBookingEventDto): Promise<BookingEventResponseDto> {
    const entity = this.repo.create(dto as Partial<BookingEvent>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateBookingEventDto): Promise<BookingEventResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('BookingEvent ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('BookingEvent ' + id + ' not found');
  }

  private toDto(entity: BookingEvent): BookingEventResponseDto {
    return entity as unknown as BookingEventResponseDto;
  }
}
