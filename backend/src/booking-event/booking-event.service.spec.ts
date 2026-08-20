import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { BookingEventType } from '../common/enums/booking-event-type.enum';
import { BookingEventService } from './booking-event.service';
import { BookingEvent } from './entities/booking-event.entity';

describe('BookingEventService', () => {
  let service: BookingEventService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const bookingId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eventId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const now = new Date('2026-08-20T14:00:00.000Z');

  const makeEvent = (overrides: Partial<BookingEvent> = {}): BookingEvent =>
    ({
      id: eventId,
      bookingId,
      actorUserId: userId,
      eventType: BookingEventType.CREATED,
      payload: { source: 'admin' },
      createdAt: now,
      ...overrides,
    }) as BookingEvent;

  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const bookingRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingEventService,
        { provide: getRepositoryToken(BookingEvent), useValue: repo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get(BookingEventService);
  });

  it('createBookingEvent persists append-only event with actor', async () => {
    const entity = makeEvent();
    bookingRepo.findOne.mockResolvedValue({ id: bookingId, organizationId: orgA });
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    const result = await service.createBookingEvent({
      bookingId,
      eventType: BookingEventType.CREATED,
      actorUserId: userId,
      payload: { source: 'admin' },
      organizationId: orgA,
    });

    expect(result).toEqual({
      id: eventId,
      bookingId,
      actorUserId: userId,
      eventType: BookingEventType.CREATED,
      payload: { source: 'admin' },
      createdAt: now.toISOString(),
    });
  });

  it('allows system-generated events with null actorUserId', async () => {
    const entity = makeEvent({ actorUserId: null });
    bookingRepo.findOne.mockResolvedValue({ id: bookingId, organizationId: orgA });
    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue(entity);

    const result = await service.createBookingEvent({
      bookingId,
      eventType: BookingEventType.CREATED,
      actorUserId: null,
      organizationId: orgA,
    });

    expect(result.actorUserId).toBeNull();
  });

  it('lists events for booking in organization ordered ASC', async () => {
    bookingRepo.findOne.mockResolvedValue({ id: bookingId, organizationId: orgA });
    repo.find.mockResolvedValue([
      makeEvent({ eventType: BookingEventType.CREATED }),
      makeEvent({
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        eventType: BookingEventType.CONFIRMED,
      }),
    ]);

    const result = await service.findByBooking(bookingId, orgA);

    expect(repo.find).toHaveBeenCalledWith({
      where: { bookingId },
      order: { createdAt: 'ASC' },
    });
    expect(result.data).toHaveLength(2);
  });

  it('rejects event history for other organizations', async () => {
    bookingRepo.findOne.mockResolvedValue(null);

    await expect(
      service.findByBooking(bookingId, orgB),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne scopes event to booking and organization', async () => {
    bookingRepo.findOne.mockResolvedValue({ id: bookingId, organizationId: orgA });
    repo.findOne.mockResolvedValue(null);

    await expect(
      service.findOne(bookingId, eventId, orgA),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: eventId, bookingId },
    });
  });

  it('is append-only: service has no update/remove public API methods', () => {
    expect((service as { update?: unknown }).update).toBeUndefined();
    expect((service as { remove?: unknown }).remove).toBeUndefined();
  });
});
