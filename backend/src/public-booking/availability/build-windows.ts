import { Logger } from '@nestjs/common';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { Interval, mergeIntervals, subtractIntervals } from './interval';
import { localDayOfWeek, resolveLocal } from './time-zone';

// One context for the whole availability engine, not a copy-paste of the
// class name: this module is a free function, not a NestJS provider, but
// its warnings belong in the same log stream as AvailabilityService's.
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
 * of failing the whole caller. Each offending row is logged at most once
 * per call, not once per date it's checked against — a bad zone is a
 * property of the row, not of any one date, and this loop revisits every
 * row once per date in the range.
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
  const warned = new Set<string>();

  for (const date of dates) {
    let weekday: number;
    try {
      weekday = localDayOfWeek(date);
    } catch (error) {
      logger.warn(`Skipping date "${date}": ${describeError(error)}`);
      continue;
    }

    for (const rule of rules) {
      if (rule.dayOfWeek !== weekday) continue;
      const zone = rule.timezone ?? organizationTimezone;
      try {
        windows.push({
          start: resolveLocal(date, rule.startTime, zone, 'earliest'),
          end: resolveLocal(date, rule.endTime, zone, 'latest'),
        });
      } catch (error) {
        warnOnce(
          warned,
          `rule:${rule.id}`,
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
        warnOnce(
          warned,
          `exception:${exception.id}`,
          `Skipping availability exception ${exception.id} for resource ${exception.resourceId}: invalid timezone "${zone}" (${describeError(error)})`,
        );
      }
    }
  }

  windows = subtractIntervals(windows, blocks);
  return mergeIntervals([...windows, ...openings]);
}

function warnOnce(warned: Set<string>, key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  logger.warn(message);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
