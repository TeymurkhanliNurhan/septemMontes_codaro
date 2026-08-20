import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';
import { Interval, mergeIntervals, subtractIntervals } from './interval';
import { computeSlots, MergedSlot, mergeResourceSlots } from './slot-math';
import { eachLocalDate, localDayOfWeek, resolveLocal } from './time-zone';

const MINUTE_MS = 60_000;

export interface SlotSearch {
  service: Service;
  organizationTimezone: string;
  from: string;
  to: string;
  resourceId?: string;
  now: number;
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

  /** ACTIVE resources capable of performing this service. */
  async capableResources(serviceId: string): Promise<Resource[]> {
    const links = await this.serviceResources.find({ where: { serviceId } });
    if (links.length === 0) return [];

    return this.resources.find({
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

  /** True when this exact instant is still bookable on this resource. */
  async isSlotFree(
    resourceId: string,
    startsAt: number,
    search: SlotSearch,
  ): Promise<boolean> {
    const resource = await this.resources.findOne({
      where: { id: resourceId, status: ResourceStatus.ACTIVE },
    });
    if (!resource) return false;

    const slots = await this.slotsForResource(resource, search);
    return slots.some((slot) => slot.start === startsAt);
  }

  private async resolveResources(search: SlotSearch): Promise<Resource[]> {
    const capable = await this.capableResources(search.service.id);
    if (!search.resourceId) return capable;
    return capable.filter((resource) => resource.id === search.resourceId);
  }

  private async slotsForResource(
    resource: Resource,
    search: SlotSearch,
  ): Promise<Interval[]> {
    const windows = await this.windowsForResource(resource, search);
    if (windows.length === 0) return [];

    const busy = await this.busyForResource(resource.id, windows);

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
   * Availability windows for one resource across the requested dates.
   * UNAVAILABLE exceptions are subtracted first and AVAILABLE ones unioned
   * after, so an explicit opening always beats an overlapping block.
   */
  private async windowsForResource(
    resource: Resource,
    search: SlotSearch,
  ): Promise<Interval[]> {
    const dates = eachLocalDate(search.from, search.to);
    if (dates.length === 0) return [];

    const [rules, exceptions] = await Promise.all([
      this.rules.find({ where: { resourceId: resource.id, isActive: true } }),
      this.exceptions.find({
        where: { resourceId: resource.id, exceptionDate: In(dates) },
      }),
    ]);

    let windows: Interval[] = [];
    const blocks: Interval[] = [];
    const openings: Interval[] = [];

    for (const date of dates) {
      const weekday = localDayOfWeek(date);

      for (const rule of rules) {
        if (rule.dayOfWeek !== weekday) continue;
        const zone = rule.timezone ?? search.organizationTimezone;
        windows.push({
          start: resolveLocal(date, rule.startTime, zone, 'earliest'),
          end: resolveLocal(date, rule.endTime, zone, 'latest'),
        });
      }

      for (const exception of exceptions) {
        if (exception.exceptionDate !== date) continue;
        const zone = search.organizationTimezone;
        const interval = {
          start: resolveLocal(date, exception.startTime, zone, 'earliest'),
          end: resolveLocal(date, exception.endTime, zone, 'latest'),
        };
        if (exception.exceptionType === AvailabilityExceptionType.UNAVAILABLE) {
          blocks.push(interval);
        } else {
          openings.push(interval);
        }
      }
    }

    windows = subtractIntervals(windows, blocks);
    return mergeIntervals([...windows, ...openings]);
  }

  /** Non-cancelled bookings occupying this resource inside the search range. */
  private async busyForResource(
    resourceId: string,
    windows: Interval[],
  ): Promise<Interval[]> {
    const rangeStart = Math.min(...windows.map((w) => w.start));
    const rangeEnd = Math.max(...windows.map((w) => w.end));

    const rows = await this.bookingResources
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
