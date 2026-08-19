import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingParticipant } from './entities/booking-participant.entity';
import { CreateBookingParticipantDto } from './dto/create-participant.dto';
import { UpdateBookingParticipantDto } from './dto/update-participant.dto';
import { BookingParticipantResponseDto } from './dto/participant-response.dto';

@Injectable()
export class BookingParticipantService {
  constructor(
    @InjectRepository(BookingParticipant)
    private readonly repo: Repository<BookingParticipant>,
  ) {}

  async findByFilter(bookingId: string): Promise<BookingParticipantResponseDto[]> {
    const items = await this.repo.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findAll(): Promise<BookingParticipantResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findOne(id: string): Promise<BookingParticipantResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('BookingParticipant ' + id + ' not found');
    return this.toDto(item);
  }

  async create(dto: CreateBookingParticipantDto): Promise<BookingParticipantResponseDto> {
    const entity = this.repo.create(dto as Partial<BookingParticipant>);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: UpdateBookingParticipantDto): Promise<BookingParticipantResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('BookingParticipant ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('BookingParticipant ' + id + ' not found');
  }

  private toDto(entity: BookingParticipant): BookingParticipantResponseDto {
    return entity as unknown as BookingParticipantResponseDto;
  }
}
