import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { DataSource, EntityManager } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingEvent } from '../../booking-event/entities/booking-event.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';
import { Customer } from '../../customer/entities/customer.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import {
  AvailabilityService,
  SlotSearch,
} from '../availability/availability.service';
import {
  CreatePublicBookingDto,
  PublicCustomerDto,
} from '../dto/create-public-booking.dto';
import { PublicBookingResponseDto } from '../dto/public-booking-response.dto';

const MINUTE_MS = 60_000;

/**
 * The only write path on the unauthenticated API.
 *
 * Two rules govern everything here:
 *
 * - **Nothing is trusted but the slug.** The organization comes from the URL,
 *   and the service and resource are re-resolved inside it. `AvailabilityService`
 *   scopes neither `capableResources` nor `isSlotFree` by organization, so this
 *   service filters the candidate list itself. Without that, a caller could post
 *   another organization's `resourceId` and have a slot computed from it.
 * - **Availability is re-derived under a row lock, on this transaction's own
 *   connection.** The slot list a browser is holding may be seconds stale, so
 *   `claimResource` locks the row and asks again — handing `isSlotFree` this
 *   transaction's `EntityManager` so the re-check reads the snapshot the lock
 *   protects instead of checking out a second connection from a pool of ten.
 */
@Injectable()
export class PublicBookingService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    slug: string,
    dto: CreatePublicBookingDto,
  ): Promise<PublicBookingResponseDto> {
    const startsAt = Date.parse(dto.startsAt);
    if (Number.isNaN(startsAt)) {
      throw new BadRequestException('startsAt is not a valid instant');
    }

    return this.dataSource.transaction(async (manager) => {
      const organization = await manager.findOne(Organization, {
        where: { slug },
      });
      if (!organization) throw new NotFoundException('Organization not found');

      const service = await manager.findOne(Service, {
        where: { id: dto.serviceId, organizationId: organization.id },
      });
      if (!service || !service.isActive) {
        throw new NotFoundException('Service not found');
      }

      const candidates = await this.candidates(
        organization.id,
        service,
        dto.resourceId,
      );
      const search = this.searchFor(organization, service, startsAt);
      const resource = await this.claimResource(
        manager,
        candidates,
        startsAt,
        search,
      );

      const customer = await this.upsertCustomer(
        manager,
        organization.id,
        dto.customer,
      );

      const endsAt = new Date(startsAt + service.durationMinutes * MINUTE_MS);
      const booking = await manager.save(Booking, {
        organizationId: organization.id,
        customerId: customer.id,
        serviceId: service.id,
        createdByUserId: null,
        startsAt: new Date(startsAt),
        endsAt,
        status: BookingStatus.PENDING,
        title: service.name,
        notes: dto.notes ?? null,
        metadata: {},
      });

      await manager.insert(BookingResource, {
        bookingId: booking.id,
        resourceId: resource.id,
      });

      await manager.save(BookingEvent, {
        bookingId: booking.id,
        actorUserId: null,
        eventType: BookingEventType.CREATED,
        payload: { source: 'public' },
      });

      return {
        bookingId: booking.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt.toISOString(),
        status: BookingStatus.PENDING,
        serviceName: service.name,
        resourceName: resource.name,
      };
    });
  }

  /**
   * Resources that may serve this booking, best first.
   *
   * `capableResources` filters by service link and ACTIVE status only, so the
   * organization filter here is the tenant boundary — a requested id that
   * belongs to another organization must look exactly like one that does not
   * exist. Under CUSTOMER_CHOICE a requested resource is the only candidate;
   * under AUTO it is merely preferred, and the rest remain as fallbacks.
   */
  private async candidates(
    organizationId: string,
    service: Service,
    requestedResourceId?: string,
  ): Promise<Resource[]> {
    const capable = (
      await this.availability.capableResources(service.id)
    ).filter((resource) => resource.organizationId === organizationId);

    // No candidates at all is a configuration problem, not contention. Saying
    // "that time was just taken" would invite the guest to retry a service
    // that no resource can ever perform.
    if (capable.length === 0) {
      throw new NotFoundException('This service is not currently bookable');
    }

    if (!requestedResourceId) return capable;

    const requested = capable.find(
      (resource) => resource.id === requestedResourceId,
    );
    if (!requested) throw new NotFoundException('Resource not found');

    if (
      service.resourceSelectionMode === ResourceSelectionMode.CUSTOMER_CHOICE
    ) {
      return [requested];
    }
    return [
      requested,
      ...capable.filter((resource) => resource.id !== requested.id),
    ];
  }

  /**
   * Locks a candidate row, then re-derives availability for that instant.
   *
   * The lock is the serialisation point: a competing transaction holding it has
   * either committed its booking — visible to the re-check that follows — or
   * rolled back. Checking availability without the lock, or holding the lock
   * without re-checking, both allow two consumers to claim one slot.
   */
  private async claimResource(
    manager: EntityManager,
    candidates: Resource[],
    startsAt: number,
    search: SlotSearch,
  ): Promise<Resource> {
    for (const candidate of candidates) {
      await manager
        .createQueryBuilder(Resource, 'resource')
        .setLock('pessimistic_write')
        .where('resource.id = :id', { id: candidate.id })
        .getOne();

      // The manager is not optional in practice: without it the re-check runs
      // on a second pool connection while this transaction holds the first, so
      // it cannot see this snapshot and, with pool max 10 and no connection
      // timeout, wedges under concurrent load instead of erroring.
      const free = await this.availability.isSlotFree(
        candidate.id,
        startsAt,
        search,
        manager,
      );
      if (free) return candidate;
    }

    throw new ConflictException('That time was just taken');
  }

  /**
   * The local day the requested instant falls on, in the organization's
   * timezone. `isSlotFree` narrows this range itself, so `from`/`to` describe
   * the instant rather than bound the work; `notBefore: now` is what keeps a
   * past instant unbookable.
   *
   * An unresolvable `organizations.timezone` falls back to the UTC date rather
   * than throwing — the column is free text with no CHECK constraint, and a bad
   * one must not turn a guest's booking into a 500.
   */
  private searchFor(
    organization: Organization,
    service: Service,
    startsAt: number,
  ): SlotSearch {
    const local = DateTime.fromMillis(startsAt, {
      zone: organization.timezone,
    });
    const date = local.isValid
      ? local.toFormat('yyyy-MM-dd')
      : new Date(startsAt).toISOString().slice(0, 10);

    return {
      service,
      organizationTimezone: organization.timezone,
      from: date,
      to: date,
      now: Date.now(),
    };
  }

  /**
   * Matches on `(organizationId, lowercased email)`, the same normalisation the
   * auth code applies. A repeat guest keeps one row and the newest details they
   * gave; an omitted phone leaves the stored one alone rather than erasing it.
   */
  private async upsertCustomer(
    manager: EntityManager,
    organizationId: string,
    input: PublicCustomerDto,
  ): Promise<Customer> {
    const email = input.email.trim().toLowerCase();

    const existing = await manager.findOne(Customer, {
      where: { organizationId, email },
    });
    if (existing) {
      existing.name = input.name;
      if (input.phone !== undefined) existing.phone = input.phone;
      return manager.save(Customer, existing);
    }

    return manager.save(Customer, {
      organizationId,
      name: input.name,
      email,
      phone: input.phone ?? null,
      metadata: {},
    });
  }
}
