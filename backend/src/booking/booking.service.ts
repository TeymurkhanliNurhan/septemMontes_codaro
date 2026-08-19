import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly repo: Repository<Booking>,
  ) {}

  async findByOrganization(organizationId: string): Promise<BookingResponseDto[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<BookingResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Booking ' + id + ' not found');
    return this.toDto(item);
  }

  async create(dto: CreateBookingDto, organizationId?: string, createdByUserId?: string): Promise<BookingResponseDto> {
    const entity = this.repo.create({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      ...(createdByUserId && { createdByUserId }),
    });
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateBookingDto): Promise<BookingResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('Booking ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Booking ' + id + ' not found');
  }

  private toDto(entity: Booking): BookingResponseDto {
    return entity as unknown as BookingResponseDto;
  }
}
