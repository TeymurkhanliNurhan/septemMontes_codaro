import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { BookingEventType } from '../common/enums/booking-event-type.enum';
import { BookingEvent } from './entities/booking-event.entity';
import {
  BookingEventListResponseDto,
  BookingEventResponseDto,
} from './dto/event-response.dto';

export type CreateBookingEventParams = {
  bookingId: string;
  eventType: BookingEventType;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  /** When set, verifies the booking belongs to this organization. */
  organizationId?: string;
  /** Optional transactional manager for atomic booking+event writes. */
  manager?: EntityManager;
};

@Injectable()
export class BookingEventService {
  constructor(
    @InjectRepository(BookingEvent)
    private readonly repo: Repository<BookingEvent>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  /**
   * Append-only domain helper. Prefer calling from Booking commands inside
   * the same transaction as the booking state change.
   */
  async createBookingEvent(
    params: CreateBookingEventParams,
  ): Promise<BookingEventResponseDto> {
    const {
      bookingId,
      eventType,
      actorUserId = null,
      payload = {},
      organizationId,
      manager,
    } = params;

    if (!Object.values(BookingEventType).includes(eventType)) {
      throw new BadRequestException(`Invalid booking event type: ${eventType}`);
    }

    if (organizationId) {
      await this.assertBookingInOrganization(
        bookingId,
        organizationId,
        manager,
      );
    }

    const eventRepo = manager
      ? manager.getRepository(BookingEvent)
      : this.repo;

    const entity = eventRepo.create({
      bookingId,
      eventType,
      actorUserId,
      payload: payload ?? {},
    });
    const saved = await eventRepo.save(entity);
    return this.toDto(saved);
  }

  async findByBooking(
    bookingId: string,
    organizationId: string,
  ): Promise<BookingEventListResponseDto> {
    await this.assertBookingInOrganization(bookingId, organizationId);

    const items = await this.repo.find({
      where: { bookingId },
      order: { createdAt: 'ASC' },
    });

    return { data: items.map((item) => this.toDto(item)) };
  }

  async findOne(
    bookingId: string,
    eventId: string,
    organizationId: string,
  ): Promise<BookingEventResponseDto> {
    await this.assertBookingInOrganization(bookingId, organizationId);

    const item = await this.repo.findOne({
      where: { id: eventId, bookingId },
    });
    if (!item) {
      throw new NotFoundException(`BookingEvent ${eventId} not found`);
    }
    return this.toDto(item);
  }

  private async assertBookingInOrganization(
    bookingId: string,
    organizationId: string,
    manager?: EntityManager,
  ): Promise<Booking> {
    if (!organizationId) {
      throw new BadRequestException(
        'Authenticated user is missing organization context',
      );
    }

    const bookingRepo = manager
      ? manager.getRepository(Booking)
      : this.bookingRepo;

    const booking = await bookingRepo.findOne({
      where: { id: bookingId, organizationId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
    return booking;
  }

  private toDto(entity: BookingEvent): BookingEventResponseDto {
    return {
      id: entity.id,
      bookingId: entity.bookingId,
      actorUserId: entity.actorUserId,
      eventType: entity.eventType,
      payload: entity.payload ?? {},
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
