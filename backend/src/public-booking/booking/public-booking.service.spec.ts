import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingEvent } from '../../booking-event/entities/booking-event.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Customer } from '../../customer/entities/customer.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import {
  AvailabilityService,
  SlotSearch,
} from '../availability/availability.service';
import { CreatePublicBookingDto } from '../dto/create-public-booking.dto';
import { PublicBookingService } from './public-booking.service';

// --- builders -------------------------------------------------------------

function buildOrganization(
  overrides: Partial<Organization> = {},
): Organization {
  return {
    id: 'org-1',
    name: 'Acme Salon',
    slug: 'acme',
    timezone: 'UTC',
    ...overrides,
  } as Organization;
}

function buildService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    organizationId: 'org-1',
    name: 'Haircut',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
    resourceSelectionMode: ResourceSelectionMode.AUTO,
    ...overrides,
  } as Service;
}

function buildResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'r-1',
    organizationId: 'org-1',
    name: 'Alice',
    status: ResourceStatus.ACTIVE,
    ...overrides,
  } as Resource;
}

function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus-1',
    organizationId: 'org-1',
    name: 'Old Name',
    email: 'dana@example.com',
    phone: '+1 555 0100',
    ...overrides,
  } as Customer;
}

function buildDto(
  overrides: Partial<CreatePublicBookingDto> = {},
): CreatePublicBookingDto {
  return {
    serviceId: 'svc-1',
    startsAt: '2026-09-01T09:00:00.000Z',
    customer: { name: 'Dana Scully', email: 'Dana@Example.com' },
    ...overrides,
  };
}

// --- doubles --------------------------------------------------------------

interface SlotCheck {
  resourceId: string;
  startsAt: number;
  search: SlotSearch;
  /** undefined when the caller forgot to hand over its transaction. */
  manager: EntityManager | undefined;
}

interface FakeDb {
  organizations: Organization[];
  services: Service[];
  customers: Customer[];
  /** Exactly what AvailabilityService.capableResources returns — unscoped. */
  capable: Resource[];
  free: Set<string>;
  savedCustomers: Record<string, unknown>[];
  savedBookings: Record<string, unknown>[];
  savedEvents: Record<string, unknown>[];
  bookedResources: Record<string, unknown>[];
}

interface Harness {
  service: PublicBookingService;
  db: FakeDb;
  /** The exact manager `dataSource.transaction` hands to the callback. */
  manager: EntityManager;
  /** Lock and availability calls in the order they happened. */
  timeline: string[];
  checks: SlotCheck[];
  state: { transactions: number };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

/** Naive `findOne` matcher: every key in `where` must match exactly. */
function pick<T extends object>(
  rows: T[],
  where: Record<string, unknown>,
): T | null {
  const found = rows.find((row) =>
    Object.entries(where).every(([key, value]) => asRecord(row)[key] === value),
  );
  return found ?? null;
}

interface SqlCondition {
  sql: string;
  params: Record<string, unknown>;
}

/**
 * Evaluates the conditions the customer lookup builds, honouring `LOWER(...)`
 * literally: a query without it matches case-sensitively, exactly as Postgres
 * would. That is what lets a test tell a `LOWER(email)` match apart from an
 * equality against an already-lowercased literal.
 */
function matchesCondition(row: Customer, condition: SqlCondition): boolean {
  const { sql, params } = condition;
  if (sql.includes('organization_id')) {
    return row.organizationId === params.organizationId;
  }
  if (/LOWER\(\s*customer\.email\s*\)/i.test(sql)) {
    return (row.email ?? '').toLowerCase() === params.email;
  }
  if (sql.includes('email')) return row.email === params.email;
  throw new Error(`unexpected condition: ${sql}`);
}

function buildManager(db: FakeDb, timeline: string[]): EntityManager {
  let nextBooking = 0;

  const lockQuery = () => {
    let locked = '?';
    let mode = 'none';
    const qb = {
      setLock(lockMode: string) {
        mode = lockMode;
        return qb;
      },
      where(_sql: string, params: Record<string, unknown>) {
        locked = String(params.id);
        return qb;
      },
      getOne(): Promise<Resource | null> {
        timeline.push(`lock:${locked}:${mode}`);
        return Promise.resolve(pick(db.capable, { id: locked }));
      },
    };
    return qb;
  };

  const customerQuery = () => {
    const conditions: SqlCondition[] = [];
    const qb = {
      where(sql: string, params: Record<string, unknown>) {
        conditions.push({ sql, params });
        return qb;
      },
      andWhere(sql: string, params: Record<string, unknown>) {
        conditions.push({ sql, params });
        return qb;
      },
      getOne(): Promise<Customer | null> {
        const found = db.customers.find((row) =>
          conditions.every((condition) => matchesCondition(row, condition)),
        );
        return Promise.resolve(found ?? null);
      },
    };
    return qb;
  };

  const manager = {
    findOne(
      target: unknown,
      options: { where?: Record<string, unknown> },
    ): Promise<unknown> {
      const where = options.where ?? {};
      if (target === Organization)
        return Promise.resolve(pick(db.organizations, where));
      if (target === Service) return Promise.resolve(pick(db.services, where));
      if (target === Customer)
        return Promise.resolve(pick(db.customers, where));
      throw new Error('unexpected findOne target');
    },

    save(target: unknown, entity: unknown): Promise<unknown> {
      const row = asRecord(entity);
      if (target === Customer) {
        db.savedCustomers.push({ ...row });
        if (row.id === undefined) row.id = 'cus-new';
        return Promise.resolve(row);
      }
      if (target === Booking) {
        db.savedBookings.push({ ...row });
        nextBooking += 1;
        row.id = `booking-${nextBooking}`;
        return Promise.resolve(row);
      }
      if (target === BookingEvent) {
        db.savedEvents.push({ ...row });
        return Promise.resolve(row);
      }
      throw new Error('unexpected save target');
    },

    insert(target: unknown, entity: unknown): Promise<unknown> {
      if (target !== BookingResource)
        throw new Error('unexpected insert target');
      db.bookedResources.push({ ...asRecord(entity) });
      return Promise.resolve({ identifiers: [], generatedMaps: [], raw: {} });
    },

    createQueryBuilder(target: unknown) {
      if (target === Resource) return lockQuery();
      if (target === Customer) return customerQuery();
      throw new Error('unexpected query builder target');
    },
  };

  return manager as unknown as EntityManager;
}

function buildAvailability(
  db: FakeDb,
  timeline: string[],
  checks: SlotCheck[],
): AvailabilityService {
  const double = {
    capableResources(): Promise<Resource[]> {
      return Promise.resolve(db.capable);
    },
    isSlotFree(
      resourceId: string,
      startsAt: number,
      search: SlotSearch,
      manager?: EntityManager,
    ): Promise<boolean> {
      timeline.push(`check:${resourceId}`);
      checks.push({ resourceId, startsAt, search, manager });
      return Promise.resolve(db.free.has(resourceId));
    },
  };
  return double as unknown as AvailabilityService;
}

interface World {
  organizations?: Organization[];
  services?: Service[];
  customers?: Customer[];
  capable?: Resource[];
  /** Resource ids still free at re-check time. Defaults to every candidate. */
  free?: string[];
}

function buildHarness(world: World = {}): Harness {
  const capable = world.capable ?? [buildResource()];
  const db: FakeDb = {
    organizations: world.organizations ?? [buildOrganization()],
    services: world.services ?? [buildService()],
    customers: world.customers ?? [],
    capable,
    free: new Set(world.free ?? capable.map((resource) => resource.id)),
    savedCustomers: [],
    savedBookings: [],
    savedEvents: [],
    bookedResources: [],
  };

  const timeline: string[] = [];
  const checks: SlotCheck[] = [];
  const state = { transactions: 0 };
  const manager = buildManager(db, timeline);

  const dataSource = {
    transaction<T>(
      run: (entityManager: EntityManager) => Promise<T>,
    ): Promise<T> {
      state.transactions += 1;
      return run(manager);
    },
  } as unknown as DataSource;

  return {
    service: new PublicBookingService(
      buildAvailability(db, timeline, checks),
      dataSource,
    ),
    db,
    manager,
    timeline,
    checks,
    state,
  };
}

// --- tests ----------------------------------------------------------------

describe('PublicBookingService.create', () => {
  describe('the booking it writes', () => {
    it('creates the booking as PENDING', async () => {
      const { service, db } = buildHarness();

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].status).toBe(BookingStatus.PENDING);
    });

    it('takes the first free capable resource', async () => {
      const { service, db } = buildHarness({
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
      });

      await service.create('acme', buildDto());

      expect(db.bookedResources).toEqual([
        { bookingId: 'booking-1', resourceId: 'r-1' },
      ]);
    });

    it('leaves created_by_user_id null', async () => {
      const { service, db } = buildHarness();

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].createdByUserId).toBeNull();
    });

    it('ends the booking one service duration after it starts', async () => {
      const { service, db } = buildHarness({
        services: [buildService({ durationMinutes: 45 })],
      });

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].endsAt).toEqual(
        new Date('2026-09-01T09:45:00.000Z'),
      );
    });

    it('titles the booking after the service', async () => {
      const { service, db } = buildHarness({
        services: [buildService({ name: 'Beard trim' })],
      });

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].title).toBe('Beard trim');
    });

    it('scopes the booking to the organization from the slug', async () => {
      const { service, db } = buildHarness();

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].organizationId).toBe('org-1');
    });

    it('records a CREATED booking event for the new booking', async () => {
      const { service, db } = buildHarness();

      await service.create('acme', buildDto());

      expect(db.savedEvents).toEqual([
        expect.objectContaining({
          bookingId: 'booking-1',
          eventType: BookingEventType.CREATED,
        }),
      ]);
    });

    it('returns the service and resource names', async () => {
      const { service } = buildHarness({
        services: [buildService({ name: 'Haircut' })],
        capable: [buildResource({ name: 'Alice' })],
      });

      const result = await service.create('acme', buildDto());

      expect(result).toEqual({
        bookingId: 'booking-1',
        startsAt: '2026-09-01T09:00:00.000Z',
        endsAt: '2026-09-01T09:30:00.000Z',
        status: BookingStatus.PENDING,
        serviceName: 'Haircut',
        resourceName: 'Alice',
      });
    });

    it('does all of it inside a single transaction', async () => {
      const { service, state } = buildHarness();

      await service.create('acme', buildDto());

      expect(state.transactions).toBe(1);
    });
  });

  describe('concurrency', () => {
    it('locks the resource row before re-deriving availability', async () => {
      const { service, timeline } = buildHarness();

      await service.create('acme', buildDto());

      expect(timeline).toEqual(['lock:r-1:pessimistic_write', 'check:r-1']);
    });

    it('re-checks on the transaction manager, never a pooled connection', async () => {
      const { service, manager, checks } = buildHarness();

      await service.create('acme', buildDto());

      expect(checks[0].manager).toBe(manager);
    });

    it('re-checks the exact requested instant', async () => {
      const { service, checks } = buildHarness();

      await service.create('acme', buildDto());

      expect(checks[0].startsAt).toBe(Date.parse('2026-09-01T09:00:00.000Z'));
    });

    it('returns 409 when the chosen resource is taken', async () => {
      const { service } = buildHarness({
        services: [
          buildService({
            resourceSelectionMode: ResourceSelectionMode.CUSTOMER_CHOICE,
          }),
        ],
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
        free: ['r-2'],
      });

      await expect(
        service.create('acme', buildDto({ resourceId: 'r-1' })),
      ).rejects.toThrow(ConflictException);
    });

    it('never falls through to another resource under CUSTOMER_CHOICE', async () => {
      const { service, timeline } = buildHarness({
        services: [
          buildService({
            resourceSelectionMode: ResourceSelectionMode.CUSTOMER_CHOICE,
          }),
        ],
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
        free: ['r-2'],
      });

      await expect(
        service.create('acme', buildDto({ resourceId: 'r-1' })),
      ).rejects.toThrow(ConflictException);
      expect(timeline).toEqual(['lock:r-1:pessimistic_write', 'check:r-1']);
    });

    it('writes no booking when the slot was just taken', async () => {
      const { service, db } = buildHarness({ free: [] });

      await expect(service.create('acme', buildDto())).rejects.toThrow(
        ConflictException,
      );
      expect(db.savedBookings).toEqual([]);
    });

    it('falls through to the next capable resource under AUTO', async () => {
      const { service, db } = buildHarness({
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
        free: ['r-2'],
      });

      await service.create('acme', buildDto());

      expect(db.bookedResources).toEqual([
        { bookingId: 'booking-1', resourceId: 'r-2' },
      ]);
    });

    it('returns 409 under AUTO when every resource is taken', async () => {
      const { service } = buildHarness({
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
        free: [],
      });

      await expect(service.create('acme', buildDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a service with no capable resource as unbookable, not taken', async () => {
      const { service } = buildHarness({ capable: [] });

      await expect(service.create('acme', buildDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('prefers the requested resource under AUTO but still falls through', async () => {
      const { service, db } = buildHarness({
        capable: [
          buildResource({ id: 'r-1', name: 'Alice' }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
        free: ['r-1', 'r-2'],
      });

      await service.create('acme', buildDto({ resourceId: 'r-2' }));

      expect(db.bookedResources).toEqual([
        { bookingId: 'booking-1', resourceId: 'r-2' },
      ]);
    });

    it('falls back to the UTC date when the organization timezone is junk', async () => {
      const { service, checks } = buildHarness({
        organizations: [buildOrganization({ timezone: 'Not/AZone' })],
      });

      await service.create(
        'acme',
        buildDto({ startsAt: '2026-09-01T02:00:00.000Z' }),
      );

      expect(checks[0].search.from).toBe('2026-09-01');
    });

    it('derives the slot search date from the organization timezone', async () => {
      const { service, checks } = buildHarness({
        organizations: [buildOrganization({ timezone: 'America/New_York' })],
      });

      await service.create(
        'acme',
        buildDto({ startsAt: '2026-09-01T02:00:00.000Z' }),
      );

      expect(checks[0].search).toEqual(
        expect.objectContaining({
          organizationTimezone: 'America/New_York',
          from: '2026-08-31',
          to: '2026-08-31',
        }),
      );
    });
  });

  describe('customer upsert', () => {
    it('reuses an existing customer with the same org and email', async () => {
      const { service, db } = buildHarness({ customers: [buildCustomer()] });

      await service.create('acme', buildDto());

      expect(db.savedCustomers[0].id).toBe('cus-1');
    });

    it('updates the name and phone on the existing row', async () => {
      const { service, db } = buildHarness({ customers: [buildCustomer()] });

      await service.create(
        'acme',
        buildDto({
          customer: {
            name: 'Dana Scully',
            email: 'Dana@Example.com',
            phone: '+1 555 0199',
          },
        }),
      );

      expect(db.savedCustomers[0]).toEqual(
        expect.objectContaining({ name: 'Dana Scully', phone: '+1 555 0199' }),
      );
    });

    it('keeps the stored phone when the request omits one', async () => {
      const { service, db } = buildHarness({ customers: [buildCustomer()] });

      await service.create('acme', buildDto());

      expect(db.savedCustomers[0].phone).toBe('+1 555 0100');
    });

    it('creates a customer when the email is new to the org', async () => {
      const { service, db } = buildHarness({ customers: [] });

      await service.create('acme', buildDto());

      expect(db.savedCustomers[0]).toEqual({
        organizationId: 'org-1',
        name: 'Dana Scully',
        email: 'dana@example.com',
        phone: null,
        metadata: {},
      });
    });

    it('matches a customer whose stored email staff saved in mixed case', async () => {
      const { service, db } = buildHarness({
        customers: [buildCustomer({ email: 'Ada@Example.com' })],
      });

      await service.create(
        'acme',
        buildDto({
          customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
        }),
      );

      expect(db.savedCustomers[0].id).toBe('cus-1');
    });

    it('does not reuse a customer with the same email in another org', async () => {
      const { service, db } = buildHarness({
        customers: [
          buildCustomer({ id: 'cus-other', organizationId: 'org-2' }),
        ],
      });

      await service.create('acme', buildDto());

      expect(db.savedCustomers[0].id).toBeUndefined();
    });

    it('links the booking to the resolved customer', async () => {
      const { service, db } = buildHarness({ customers: [buildCustomer()] });

      await service.create('acme', buildDto());

      expect(db.savedBookings[0].customerId).toBe('cus-1');
    });
  });

  describe('organization and service scoping', () => {
    it('rejects an unknown organization slug', async () => {
      const { service } = buildHarness();

      await expect(service.create('nope', buildDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a service that belongs to another organization', async () => {
      const { service } = buildHarness({
        services: [buildService({ organizationId: 'org-2' })],
      });

      await expect(service.create('acme', buildDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an inactive service', async () => {
      const { service } = buildHarness({
        services: [buildService({ isActive: false })],
      });

      await expect(service.create('acme', buildDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a resourceId that cannot perform the service', async () => {
      const { service } = buildHarness({
        capable: [buildResource({ id: 'r-1' })],
      });

      await expect(
        service.create('acme', buildDto({ resourceId: 'r-9' })),
      ).rejects.toThrow(NotFoundException);
    });

    // The org-1 resource is load-bearing: without it the filtered set would be
    // empty and the "not bookable" guard would reject before the requested-id
    // check ran, so the test would pass without proving anything about it.
    it('rejects a capable resource that belongs to another organization', async () => {
      const { service } = buildHarness({
        capable: [
          buildResource({
            id: 'r-foreign',
            name: 'Aaron',
            organizationId: 'org-2',
          }),
          buildResource({ id: 'r-1', name: 'Bella' }),
        ],
      });

      await expect(
        service.create('acme', buildDto({ resourceId: 'r-foreign' })),
      ).rejects.toThrow(NotFoundException);
    });

    it('never books a capable resource from another organization under AUTO', async () => {
      const { service, db } = buildHarness({
        capable: [
          buildResource({
            id: 'r-foreign',
            name: 'Aaron',
            organizationId: 'org-2',
          }),
          buildResource({ id: 'r-2', name: 'Bella' }),
        ],
      });

      await service.create('acme', buildDto());

      expect(db.bookedResources).toEqual([
        { bookingId: 'booking-1', resourceId: 'r-2' },
      ]);
    });

    it('rejects an unparseable startsAt', async () => {
      const { service } = buildHarness();

      await expect(
        service.create('acme', buildDto({ startsAt: 'not-a-date' })),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
