import { Logger } from '@nestjs/common';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { Interval, mergeIntervals, subtractIntervals } from './interval';
import { localDayOfWeek, resolveLocal } from './time-zone';

const logger = new Logger('AvailabilityService');

/**
 * Availability windows for one resource across a set of calendar dates,
 * derived from its weekly rules and any per-date exceptions. UNAVAILABLE
 * exceptions are subtracted first and AVAILABLE ones unioned after, so an
 * explicit opening always beats an overlapping block, regardless of the
 * order the exception rows arrive in.
 *
 * `availability_rules.timezone` and the organization's timezone are
 * free-text with no CHECK constraint. A rule or exception whose zone
 * `resolveLocal` can't resolve is skipped and logged rather than allowed to
 * throw, so one bad row degrades this resource to less availability instead
 * of failing the whole caller.
 */
export function buildWindows(
  dates: string[],
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
  organizationTimezone: string,
): Interval[] {
  let windows: Interval[] = [];
  const blocks: Interval[] = [];
  const openings: Interval[] = [];

  for (const date of dates) {
    const weekday = localDayOfWeek(date);

    for (const rule of rules) {
      if (rule.dayOfWeek !== weekday) continue;
      const zone = rule.timezone ?? organizationTimezone;
      try {
        windows.push({
          start: resolveLocal(date, rule.startTime, zone, 'earliest'),
          end: resolveLocal(date, rule.endTime, zone, 'latest'),
        });
      } catch (error) {
        logger.warn(
          `Skipping availability rule ${rule.id} for resource ${rule.resourceId}: invalid timezone "${zone}" (${describeError(error)})`,
        );
      }
    }

    for (const exception of exceptions) {
      if (exception.exceptionDate !== date) continue;
      const zone = organizationTimezone;
      try {
        const interval = {
          start: resolveLocal(date, exception.startTime, zone, 'earliest'),
          end: resolveLocal(date, exception.endTime, zone, 'latest'),
        };
        if (exception.exceptionType === AvailabilityExceptionType.UNAVAILABLE) {
          blocks.push(interval);
        } else {
          openings.push(interval);
        }
      } catch (error) {
        logger.warn(
          `Skipping availability exception ${exception.id} for resource ${exception.resourceId}: invalid timezone "${zone}" (${describeError(error)})`,
        );
      }
    }
  }

  windows = subtractIntervals(windows, blocks);
  return mergeIntervals([...windows, ...openings]);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
