import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BookingEventService } from '../booking-event/booking-event.service';
import { BookingEventType } from '../common/enums/booking-event-type.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';

describe('BookingService', () => {
  let service: BookingService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const bookingId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const now = new Date('2026-08-20T14:00:00.000Z');
  const later = new Date('2026-08-20T15:00:00.000Z');

  const makeBooking = (overrides: Partial<Booking> = {}): Booking =>
    ({
      id: bookingId,
      organizationId: orgA,
      customerId: null,
      serviceId: null,
      createdByUserId: userId,
      startsAt: now,
      endsAt: later,
      status: BookingStatus.PENDING,
      title: 'Consult',
      notes: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }) as Booking;

  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  };

  const bookingEventService = {
    createBookingEvent: jest.fn(),
  };

  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    getRepository: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) =>
      cb(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useValue: repo },
        { provide: BookingEventService, useValue: bookingEventService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(BookingService);
  });

  describe('create', () => {
    it('creates booking and CREATED event atomically with actorUserId', async () => {
      const entity = makeBooking();
      manager.create.mockReturnValue(entity);
      manager.save.mockResolvedValue(entity);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      const result = await service.create(
        {
          startsAt: now.toISOString(),
          endsAt: later.toISOString(),
          title: 'Consult',
        },
        orgA,
        userId,
      );

      expect(manager.create).toHaveBeenCalledWith(
        Booking,
        expect.objectContaining({
          organizationId: orgA,
          createdByUserId: userId,
          status: BookingStatus.PENDING,
        }),
      );
      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId,
          eventType: BookingEventType.CREATED,
          actorUserId: userId,
          organizationId: orgA,
          manager,
          payload: { source: 'admin' },
        }),
      );
      expect(result.status).toBe(BookingStatus.PENDING);
    });

    it('does not trust client organizationId', async () => {
      const entity = makeBooking({ organizationId: orgA });
      manager.create.mockReturnValue(entity);
      manager.save.mockResolvedValue(entity);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      await service.create(
        {
          startsAt: now.toISOString(),
          endsAt: later.toISOString(),
          // @ts-expect-error probing rejected client org field
          organizationId: orgB,
        },
        orgA,
        userId,
      );

      expect(manager.create.mock.calls[0][1].organizationId).toBe(orgA);
    });
  });

  describe('status transitions + events', () => {
    it('emits CONFIRMED when confirming', async () => {
      const entity = makeBooking();
      manager.findOne.mockResolvedValue(entity);
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      const result = await service.confirm(bookingId, orgA, userId);

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: BookingEventType.CONFIRMED,
          actorUserId: userId,
          payload: { confirmationMethod: 'admin' },
        }),
      );
    });

    it('emits CANCELLED with reason', async () => {
      const entity = makeBooking({ status: BookingStatus.CONFIRMED });
      manager.findOne.mockResolvedValue(entity);
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      await service.cancel(bookingId, orgA, userId, {
        reason: 'Customer cancellation',
      });

      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: BookingEventType.CANCELLED,
          payload: { reason: 'Customer cancellation' },
        }),
      );
    });

    it('emits RESCHEDULED with old and new schedule', async () => {
      const entity = makeBooking({ status: BookingStatus.CONFIRMED });
      manager.findOne.mockResolvedValue(entity);
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      const newStart = '2026-08-21T16:00:00.000Z';
      const newEnd = '2026-08-21T17:00:00.000Z';

      await service.reschedule(bookingId, orgA, userId, {
        startsAt: newStart,
        endsAt: newEnd,
        reason: 'Customer requested a new time',
      });

      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: BookingEventType.RESCHEDULED,
          payload: expect.objectContaining({
            oldStart: now.toISOString(),
            oldEnd: later.toISOString(),
            newStart,
            newEnd,
            reason: 'Customer requested a new time',
          }),
        }),
      );
    });

    it('emits COMPLETED when completing', async () => {
      const entity = makeBooking({ status: BookingStatus.CONFIRMED });
      manager.findOne.mockResolvedValue(entity);
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      const result = await service.complete(bookingId, orgA, userId);

      expect(result.status).toBe(BookingStatus.COMPLETED);
      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: BookingEventType.COMPLETED }),
      );
    });

    it('emits NO_SHOW when marking no-show', async () => {
      const entity = makeBooking({ status: BookingStatus.CONFIRMED });
      manager.findOne.mockResolvedValue(entity);
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockResolvedValue({});

      const result = await service.markNoShow(bookingId, orgA, userId);

      expect(result.status).toBe(BookingStatus.NO_SHOW);
      expect(bookingEventService.createBookingEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: BookingEventType.NO_SHOW }),
      );
    });

    it('rejects invalid status transition', async () => {
      manager.findOne.mockResolvedValue(
        makeBooking({ status: BookingStatus.CANCELLED }),
      );

      await expect(
        service.confirm(bookingId, orgA, userId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingEventService.createBookingEvent).not.toHaveBeenCalled();
    });

    it('rolls back conceptually when event persistence fails inside transaction', async () => {
      manager.findOne.mockResolvedValue(makeBooking());
      manager.save.mockImplementation(async (value: Booking) => value);
      bookingEventService.createBookingEvent.mockRejectedValue(
        new Error('event write failed'),
      );

      await expect(
        service.confirm(bookingId, orgA, userId),
      ).rejects.toThrow('event write failed');
    });
  });

  describe('organization scoping', () => {
    it('findOne rejects cross-organization access', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(bookingId, orgB)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: bookingId, organizationId: orgB },
      });
    });
  });
});
