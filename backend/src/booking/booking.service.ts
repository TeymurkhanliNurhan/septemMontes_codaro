import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BookingEventService } from '../booking-event/booking-event.service';
import { BookingEventType } from '../common/enums/booking-event-type.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
} from './dto/booking-response.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly repo: Repository<Booking>,
    private readonly bookingEventService: BookingEventService,
    private readonly dataSource: DataSource,
  ) {}

  async findByOrganization(
    organizationId: string,
  ): Promise<BookingListResponseDto> {
    this.requireOrganizationId(organizationId);
    const items = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return { data: items.map((item) => this.toDto(item)) };
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<BookingResponseDto> {
    const item = await this.findBookingForOrganization(id, organizationId);
    return this.toDto(item);
  }

  async create(
    dto: CreateBookingDto,
    organizationId: string,
    actorUserId: string,
  ): Promise<BookingResponseDto> {
    this.requireOrganizationId(organizationId);
    this.assertValidTimeRange(dto.startsAt, dto.endsAt);

    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(Booking, {
        organizationId,
        customerId: dto.customerId ?? null,
        serviceId: dto.serviceId ?? null,
        createdByUserId: actorUserId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: BookingStatus.PENDING,
        title: dto.title ?? null,
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
      });
      const saved = await manager.save(entity);

      await this.bookingEventService.createBookingEvent({
        bookingId: saved.id,
        eventType: BookingEventType.CREATED,
        actorUserId,
        payload: { source: 'admin' },
        organizationId,
        manager,
      });

      return this.toDto(saved);
    });
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    organizationId: string,
  ): Promise<BookingResponseDto> {
    const entity = await this.findBookingForOrganization(id, organizationId);

    if (dto.title !== undefined) {
      entity.title = dto.title;
    }
    if (dto.notes !== undefined) {
      entity.notes = dto.notes;
    }
    if (dto.metadata !== undefined) {
      entity.metadata = dto.metadata;
    }

    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const entity = await this.findBookingForOrganization(id, organizationId);
    await this.repo.delete(entity.id);
  }

  async confirm(
    id: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<BookingResponseDto> {
    return this.transitionStatus(
      id,
      organizationId,
      actorUserId,
      BookingStatus.CONFIRMED,
      BookingEventType.CONFIRMED,
      [BookingStatus.PENDING],
      { confirmationMethod: 'admin' },
    );
  }

  async cancel(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: CancelBookingDto = {},
  ): Promise<BookingResponseDto> {
    return this.transitionStatus(
      id,
      organizationId,
      actorUserId,
      BookingStatus.CANCELLED,
      BookingEventType.CANCELLED,
      [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      { reason: dto.reason ?? null },
    );
  }

  async complete(
    id: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<BookingResponseDto> {
    return this.transitionStatus(
      id,
      organizationId,
      actorUserId,
      BookingStatus.COMPLETED,
      BookingEventType.COMPLETED,
      [BookingStatus.CONFIRMED],
      {},
    );
  }

  async markNoShow(
    id: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<BookingResponseDto> {
    return this.transitionStatus(
      id,
      organizationId,
      actorUserId,
      BookingStatus.NO_SHOW,
      BookingEventType.NO_SHOW,
      [BookingStatus.CONFIRMED],
      {},
    );
  }

  async reschedule(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingResponseDto> {
    this.assertValidTimeRange(dto.startsAt, dto.endsAt);

    return this.dataSource.transaction(async (manager) => {
      const entity = await this.findBookingLocked(manager, id, organizationId);

      if (
        entity.status !== BookingStatus.PENDING &&
        entity.status !== BookingStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          `Cannot reschedule a booking in status ${entity.status}`,
        );
      }

      const oldStart = entity.startsAt.toISOString();
      const oldEnd = entity.endsAt.toISOString();
      entity.startsAt = new Date(dto.startsAt);
      entity.endsAt = new Date(dto.endsAt);

      const saved = await manager.save(entity);

      await this.bookingEventService.createBookingEvent({
        bookingId: saved.id,
        eventType: BookingEventType.RESCHEDULED,
        actorUserId,
        payload: {
          oldStart,
          oldEnd,
          newStart: saved.startsAt.toISOString(),
          newEnd: saved.endsAt.toISOString(),
          reason: dto.reason ?? null,
        },
        organizationId,
        manager,
      });

      return this.toDto(saved);
    });
  }

  private async transitionStatus(
    id: string,
    organizationId: string,
    actorUserId: string,
    nextStatus: BookingStatus,
    eventType: BookingEventType,
    allowedFrom: BookingStatus[],
    payload: Record<string, unknown>,
  ): Promise<BookingResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const entity = await this.findBookingLocked(manager, id, organizationId);

      if (!allowedFrom.includes(entity.status)) {
        throw new BadRequestException(
          `Cannot transition booking from ${entity.status} to ${nextStatus}`,
        );
      }

      entity.status = nextStatus;
      const saved = await manager.save(entity);

      await this.bookingEventService.createBookingEvent({
        bookingId: saved.id,
        eventType,
        actorUserId,
        payload,
        organizationId,
        manager,
      });

      return this.toDto(saved);
    });
  }

  private async findBookingLocked(
    manager: EntityManager,
    id: string,
    organizationId: string,
  ): Promise<Booking> {
    this.requireOrganizationId(organizationId);
    const entity = await manager.findOne(Booking, {
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!entity) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return entity;
  }

  async findBookingForOrganization(
    id: string,
    organizationId: string,
  ): Promise<Booking> {
    this.requireOrganizationId(organizationId);
    const item = await this.repo.findOne({
      where: { id, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return item;
  }

  private assertValidTimeRange(startsAt: string, endsAt: string): void {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid booking time range');
    }
    if (end <= start) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private requireOrganizationId(organizationId: string): void {
    if (!organizationId) {
      throw new BadRequestException(
        'Authenticated user is missing organization context',
      );
    }
  }

  private toDto(entity: Booking): BookingResponseDto {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      customerId: entity.customerId,
      serviceId: entity.serviceId,
      createdByUserId: entity.createdByUserId,
      startsAt: entity.startsAt.toISOString(),
      endsAt: entity.endsAt.toISOString(),
      status: entity.status,
      title: entity.title,
      notes: entity.notes,
      metadata: entity.metadata ?? {},
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
