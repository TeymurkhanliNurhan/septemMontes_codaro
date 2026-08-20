import { Logger } from '@nestjs/common';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { buildWindows } from './build-windows';

// --- builders ---------------------------------------------------------

let ruleSeq = 0;
function buildRule(
  overrides: Partial<AvailabilityRule> = {},
): AvailabilityRule {
  ruleSeq += 1;
  return {
    id: `rule-${ruleSeq}`,
    resourceId: 'resource-1',
    dayOfWeek: 1,
    startTime: '09:00:00',
    endTime: '17:00:00',
    timezone: null,
    isActive: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AvailabilityRule;
}

let exceptionSeq = 0;
function buildException(
  overrides: Partial<AvailabilityException> = {},
): AvailabilityException {
  exceptionSeq += 1;
  return {
    id: `exception-${exceptionSeq}`,
    resourceId: 'resource-1',
    exceptionDate: '2026-08-24',
    startTime: '09:00:00',
    endTime: '17:00:00',
    exceptionType: AvailabilityExceptionType.UNAVAILABLE,
    reason: null,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  } as AvailabilityException;
}

// 2026-08-24 is a Monday (weekday 1).
const MONDAY = '2026-08-24';

describe('buildWindows', () => {
  it('builds a window from a matching weekly rule', () => {
    const windows = buildWindows([MONDAY], [buildRule()], [], 'UTC');

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
    ]);
  });

  it('skips a rule whose day of week does not match the date', () => {
    const windows = buildWindows(
      [MONDAY],
      [buildRule({ dayOfWeek: 2 })], // Tuesday
      [],
      'UTC',
    );

    expect(windows).toEqual([]);
  });

  it('returns no windows for a weekday with no matching rules', () => {
    const windows = buildWindows([MONDAY], [], [], 'UTC');
    expect(windows).toEqual([]);
  });

  it('uses a rule-level timezone override instead of the organization zone', () => {
    const windows = buildWindows(
      [MONDAY],
      [
        buildRule({
          startTime: '09:00:00',
          endTime: '17:00:00',
          timezone: 'Asia/Tokyo',
        }),
      ],
      [],
      'America/New_York',
    );

    // 09:00-17:00 Asia/Tokyo (UTC+9), not America/New_York.
    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T00:00:00.000Z'),
        end: Date.parse('2026-08-24T08:00:00.000Z'),
      },
    ]);
  });

  it('subtracts an UNAVAILABLE exception from the rule window', () => {
    const windows = buildWindows(
      [MONDAY],
      [buildRule()],
      [
        buildException({
          exceptionDate: MONDAY,
          startTime: '12:00:00',
          endTime: '13:00:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
        }),
      ],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T12:00:00.000Z'),
      },
      {
        start: Date.parse('2026-08-24T13:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
    ]);
  });

  it('an AVAILABLE opening beats an overlapping UNAVAILABLE block (block listed first)', () => {
    const windows = buildWindows(
      [MONDAY],
      [], // no weekly rule at all; the day is only open because of the exceptions
      [
        buildException({
          exceptionDate: MONDAY,
          startTime: '09:00:00',
          endTime: '17:00:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
        }),
        buildException({
          exceptionDate: MONDAY,
          startTime: '12:00:00',
          endTime: '13:00:00',
          exceptionType: AvailabilityExceptionType.AVAILABLE,
        }),
      ],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T12:00:00.000Z'),
        end: Date.parse('2026-08-24T13:00:00.000Z'),
      },
    ]);
  });

  it('an AVAILABLE opening beats an overlapping UNAVAILABLE block (opening listed first)', () => {
    const windows = buildWindows(
      [MONDAY],
      [],
      [
        buildException({
          exceptionDate: MONDAY,
          startTime: '12:00:00',
          endTime: '13:00:00',
          exceptionType: AvailabilityExceptionType.AVAILABLE,
        }),
        buildException({
          exceptionDate: MONDAY,
          startTime: '09:00:00',
          endTime: '17:00:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
        }),
      ],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T12:00:00.000Z'),
        end: Date.parse('2026-08-24T13:00:00.000Z'),
      },
    ]);
  });

  it('skips a rule with an unresolvable timezone instead of throwing, leaving other rules intact', () => {
    const goodRule = buildRule({
      id: 'rule-good',
      startTime: '09:00:00',
      endTime: '12:00:00',
    });
    const badRule = buildRule({
      id: 'rule-bad',
      startTime: '13:00:00',
      endTime: '17:00:00',
      timezone: 'Not/A_Real_Zone',
    });

    const windows = buildWindows([MONDAY], [goodRule, badRule], [], 'UTC');

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T12:00:00.000Z'),
      },
    ]);
  });

  it('skips an exception with an unresolvable organization timezone instead of throwing', () => {
    const windows = buildWindows(
      [MONDAY],
      // Give the rule its own zone so it doesn't also fall back to the
      // (deliberately bad) organization timezone under test.
      [buildRule({ timezone: 'UTC' })],
      [
        buildException({
          exceptionDate: MONDAY,
          startTime: '12:00:00',
          endTime: '13:00:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
        }),
      ],
      'Not/A_Real_Zone',
    );

    // The exception can't be resolved and is skipped, so the rule window
    // survives untouched instead of the whole date failing.
    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
    ]);
  });

  it('merges windows across multiple dates', () => {
    const windows = buildWindows(
      ['2026-08-24', '2026-08-25'],
      [buildRule({ dayOfWeek: 1 }), buildRule({ dayOfWeek: 2 })],
      [],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
      {
        start: Date.parse('2026-08-25T09:00:00.000Z'),
        end: Date.parse('2026-08-25T17:00:00.000Z'),
      },
    ]);
  });

  it('an exception on one date does not affect other dates in the range', () => {
    const TUESDAY = '2026-08-25';

    const windows = buildWindows(
      [MONDAY, TUESDAY],
      [buildRule({ dayOfWeek: 1 }), buildRule({ dayOfWeek: 2 })],
      [
        buildException({
          exceptionDate: TUESDAY,
          startTime: '09:00:00',
          endTime: '17:00:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
        }),
      ],
      'UTC',
    );

    // Only Tuesday is closed. If the per-date filter on exceptionDate were
    // missing, this single exception would apply to every date `buildWindows`
    // is asked about -- exactly the shape `windowsForResource` fetches in,
    // since it loads all exceptions in the range with one `In(dates)` query.
    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
    ]);
  });

  it('resolves a rule end time to the later occurrence on an ambiguous fall-back date', () => {
    // Europe/Berlin falls back from 03:00 to 02:00 on 2026-10-25 (a Sunday,
    // weekday 0), so 02:00-03:00 occurs twice. A rule ending at 02:30 must
    // resolve to the *later* occurrence, so the window spans the repeated
    // hour instead of closing an hour early.
    const SUNDAY = '2026-10-25';

    const windows = buildWindows(
      [SUNDAY],
      [
        buildRule({
          dayOfWeek: 0,
          startTime: '01:00:00',
          endTime: '02:30:00',
          timezone: 'Europe/Berlin',
        }),
      ],
      [],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-10-24T23:00:00.000Z'),
        end: Date.parse('2026-10-25T01:30:00.000Z'),
      },
    ]);
  });

  it('skips a malformed date instead of throwing, leaving other dates intact', () => {
    const windows = buildWindows(
      ['not-a-date', MONDAY],
      [buildRule()],
      [],
      'UTC',
    );

    expect(windows).toEqual([
      {
        start: Date.parse('2026-08-24T09:00:00.000Z'),
        end: Date.parse('2026-08-24T17:00:00.000Z'),
      },
    ]);
  });

  it('logs a bad rule at most once per call, not once per date it matches', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const badRule = buildRule({
      id: 'rule-bad-repeat',
      dayOfWeek: 1,
      timezone: 'Not/A_Real_Zone',
    });

    // Three Mondays: the same rule matches all three dates in one call.
    buildWindows(
      ['2026-08-24', '2026-08-31', '2026-09-07'],
      [badRule],
      [],
      'UTC',
    );

    const ruleWarnings = warnSpy.mock.calls.filter(([message]) =>
      String(message).includes(`rule ${badRule.id}`),
    );
    expect(ruleWarnings).toHaveLength(1);

    warnSpy.mockRestore();
  });
});
