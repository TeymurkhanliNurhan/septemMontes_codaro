import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';
import { buildWindows } from './build-windows';
import { Interval } from './interval';
import {
  computeFreeIntervals,
  computeSlots,
  MergedSlot,
  mergeResourceSlots,
} from './slot-math';
import { eachLocalDate } from './time-zone';

const MINUTE_MS = 60_000;

export interface SlotSearch {
  service: Service;
  organizationTimezone: string;
  from: string;
  to: string;
  resourceId?: string;
  now: number;
}

/**
 * Calendar date (`yyyy-MM-dd`) owning an instant in the given zone, for
 * narrowing `isSlotFree`'s search range around a single `startsAt`. Falls
 * back to the UTC calendar date if the zone can't be resolved, rather than
 * throwing — `organizations.timezone` is free-text with no CHECK constraint.
 * This fallback only picks which dates to load, not a correctness boundary:
 * `buildWindows` independently warns for every rule/exception row using the
 * same bad zone, so a malformed organization timezone is never invisible —
 * it just surfaces as a logged warning and reduced availability rather than
 * a crash here.
 */
function localDateString(instant: number, zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(instant));
  } catch {
    return new Date(instant).toISOString().slice(0, 10);
  }
}

/** Shifts a `yyyy-MM-dd` calendar date by `delta` days. */
function addDays(date: string, delta: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Resource)
    private readonly resources: Repository<Resource>,
    @InjectRepository(ServiceResource)
    private readonly serviceResources: Repository<ServiceResource>,
    @InjectRepository(AvailabilityRule)
    private readonly rules: Repository<AvailabilityRule>,
    @InjectRepository(AvailabilityException)
    private readonly exceptions: Repository<AvailabilityException>,
    @InjectRepository(BookingResource)
    private readonly bookingResources: Repository<BookingResource>,
  ) {}

  /**
   * ACTIVE resources capable of performing this service.
   *
   * Same reasoning as `isSlotFree`: a caller running this inside a
   * transaction must pass its `manager` so both queries land on the locking
   * connection, not a second pooled one — otherwise, holding a transaction
   * connection while this opens another is enough to wedge the pool (max 10,
   * no connection timeout) under concurrent load, even before any row lock
   * is taken.
   */
  async capableResources(
    serviceId: string,
    manager?: EntityManager,
  ): Promise<Resource[]> {
    const serviceResources =
      manager?.getRepository(ServiceResource) ?? this.serviceResources;
    const resources = manager?.getRepository(Resource) ?? this.resources;

    const links = await serviceResources.find({ where: { serviceId } });
    if (links.length === 0) return [];

    return resources.find({
      where: {
        id: In(links.map((link) => link.resourceId)),
        status: ResourceStatus.ACTIVE,
      },
      order: { name: 'ASC' },
    });
  }

  async findSlots(search: SlotSearch): Promise<MergedSlot[]> {
    const resources = await this.resolveResources(search);
    if (resources.length === 0) return [];

    const perResource = await Promise.all(
      resources.map(async (resource) => ({
        resourceId: resource.id,
        slots: await this.slotsForResource(resource, search),
      })),
    );

    return mergeResourceSlots(perResource);
  }

  /**
   * True when `[startsAt, startsAt + duration)` is fully bookable on this
   * resource, i.e. contained in one free interval and not in the past.
   *
   * This answers the containment question directly rather than regenerating
   * `findSlots`' slot grid and looking `startsAt` up in it. The grid's phase
   * depends on where its underlying free interval starts, which shifts with
   * how wide the requested date range is whenever windows bridge midnight
   * (a 24/7 resource, or adjacent daily rules that touch) and the duration
   * doesn't evenly divide a day (e.g. 50 or 25 minutes, but not 30 or 60).
   * A grid built from a narrow range and one built from a wide range then
   * disagree on which instants are valid starts, so narrowing the range (as
   * this method must, to stay cheap) previously rejected slots `findSlots`
   * had just advertised. Containment has no grid to be out of phase with,
   * so the range width stops being a correctness concern — only a
   * load-window heuristic for which rows to fetch. It also fixes a
   * pre-existing false conflict: an unrelated booking elsewhere in the day
   * no longer re-phases the whole grid and knocks out unrelated slots.
   *
   * Callers use this inside a transaction with a row lock already held on
   * the resource, so `manager` must be passed to run every query on the
   * locking connection — otherwise this checks a separate pool connection,
   * can't see the locking transaction's snapshot, and (under load) can
   * starve the pool waiting for a connection that a sibling request is
   * holding open for the same reason.
   */
  async isSlotFree(
    resourceId: string,
    startsAt: number,
    search: SlotSearch,
    manager?: EntityManager,
  ): Promise<boolean> {
    if (startsAt < search.now) return false;

    const resources = manager?.getRepository(Resource) ?? this.resources;
    const resource = await resources.findOne({
      where: { id: resourceId, status: ResourceStatus.ACTIVE },
    });
    if (!resource) return false;

    const anchor = localDateString(startsAt, search.organizationTimezone);
    const narrowed: SlotSearch = {
      ...search,
      from: addDays(anchor, -1),
      to: addDays(anchor, 1),
    };

    const windows = await this.windowsForResource(resource, narrowed, manager);
    if (windows.length === 0) return false;

    const busy = await this.busyForResource(resource.id, windows, manager);
    const free = computeFreeIntervals(
      windows,
      busy,
      search.service.bufferBeforeMinutes * MINUTE_MS,
      search.service.bufferAfterMinutes * MINUTE_MS,
    );

    const end = startsAt + search.service.durationMinutes * MINUTE_MS;
    return free.some(
      (interval) => interval.start <= startsAt && end <= interval.end,
    );
  }

  private async resolveResources(
    search: SlotSearch,
    manager?: EntityManager,
  ): Promise<Resource[]> {
    const capable = await this.capableResources(search.service.id, manager);
    if (!search.resourceId) return capable;
    return capable.filter((resource) => resource.id === search.resourceId);
  }

  private async slotsForResource(
    resource: Resource,
    search: SlotSearch,
    manager?: EntityManager,
  ): Promise<Interval[]> {
    const windows = await this.windowsForResource(resource, search, manager);
    if (windows.length === 0) return [];

    const busy = await this.busyForResource(resource.id, windows, manager);

    return computeSlots({
      windows,
      busy,
      durationMs: search.service.durationMinutes * MINUTE_MS,
      bufferBeforeMs: search.service.bufferBeforeMinutes * MINUTE_MS,
      bufferAfterMs: search.service.bufferAfterMinutes * MINUTE_MS,
      notBefore: search.now,
    });
  }

  /**
   * Availability windows for one resource across the requested dates: loads
   * its weekly rules and any per-date exceptions, then delegates the
   * precedence and timezone-resolution logic to `buildWindows`.
   */
  private async windowsForResource(
    resource: Resource,
    search: SlotSearch,
    manager?: EntityManager,
  ): Promise<Interval[]> {
    const dates = eachLocalDate(search.from, search.to);
    if (dates.length === 0) return [];

    const rules = manager?.getRepository(AvailabilityRule) ?? this.rules;
    const exceptions =
      manager?.getRepository(AvailabilityException) ?? this.exceptions;

    const [ruleRows, exceptionRows] = await Promise.all([
      rules.find({ where: { resourceId: resource.id, isActive: true } }),
      exceptions.find({
        where: { resourceId: resource.id, exceptionDate: In(dates) },
      }),
    ]);

    return buildWindows(
      dates,
      ruleRows,
      exceptionRows,
      search.organizationTimezone,
    );
  }

  /** Non-cancelled bookings occupying this resource inside the search range. */
  private async busyForResource(
    resourceId: string,
    windows: Interval[],
    manager?: EntityManager,
  ): Promise<Interval[]> {
    const rangeStart = Math.min(...windows.map((w) => w.start));
    const rangeEnd = Math.max(...windows.map((w) => w.end));

    const bookingResources =
      manager?.getRepository(BookingResource) ?? this.bookingResources;

    const rows = await bookingResources
      .createQueryBuilder('br')
      .innerJoinAndSelect('br.booking', 'booking')
      .where('br.resource_id = :resourceId', { resourceId })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .andWhere('booking.starts_at < :rangeEnd', {
        rangeEnd: new Date(rangeEnd),
      })
      .andWhere('booking.ends_at > :rangeStart', {
        rangeStart: new Date(rangeStart),
      })
      .getMany();

    return rows
      .map((row) => row.booking)
      .filter((booking): booking is Booking => Boolean(booking))
      .map((booking) => ({
        start: booking.startsAt.getTime(),
        end: booking.endsAt.getTime(),
      }));
  }
}
