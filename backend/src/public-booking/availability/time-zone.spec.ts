import {
  eachLocalDate,
  localDayBounds,
  localDayOfWeek,
  resolveLocal,
} from './time-zone';

describe('localDayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    expect(localDayOfWeek('2026-08-23')).toBe(0);
  });

  it('returns 6 for Saturday', () => {
    expect(localDayOfWeek('2026-08-22')).toBe(6);
  });

  it('returns 1 for Monday', () => {
    expect(localDayOfWeek('2026-08-24')).toBe(1);
  });
});

describe('eachLocalDate', () => {
  it('enumerates an inclusive range', () => {
    expect(eachLocalDate('2026-08-24', '2026-08-26')).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
    ]);
  });

  it('returns a single date when from equals to', () => {
    expect(eachLocalDate('2026-08-24', '2026-08-24')).toEqual(['2026-08-24']);
  });

  it('returns empty when to precedes from', () => {
    expect(eachLocalDate('2026-08-26', '2026-08-24')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(eachLocalDate('2026-08-30', '2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});

describe('resolveLocal', () => {
  it('converts a plain local time to the right instant', () => {
    const millis = resolveLocal('2026-08-24', '09:00:00', 'Europe/Istanbul');
    expect(new Date(millis).toISOString()).toBe('2026-08-24T06:00:00.000Z');
  });

  it('honours a different zone for the same wall time', () => {
    const millis = resolveLocal('2026-08-24', '09:00:00', 'UTC');
    expect(new Date(millis).toISOString()).toBe('2026-08-24T09:00:00.000Z');
  });

  it('shifts a non-existent spring-forward time past the gap', () => {
    // 02:30 never happens on 2026-03-29 in Berlin: the clock jumps 02:00 to
    // 03:00. Luxon moves it forward by the offset, landing on 03:30 local.
    // This expectation was verified against luxon, not assumed.
    const millis = resolveLocal('2026-03-29', '02:30:00', 'Europe/Berlin');
    expect(new Date(millis).toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('picks the earlier occurrence of an ambiguous time by default', () => {
    // 02:30 happens twice on 2026-10-25 in Berlin.
    const millis = resolveLocal('2026-10-25', '02:30:00', 'Europe/Berlin');
    expect(new Date(millis).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('picks the later occurrence when asked', () => {
    const millis = resolveLocal(
      '2026-10-25',
      '02:30:00',
      'Europe/Berlin',
      'latest',
    );
    expect(new Date(millis).toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  it('is unaffected by prefer on an unambiguous time', () => {
    expect(resolveLocal('2026-08-24', '09:00:00', 'UTC', 'latest')).toBe(
      resolveLocal('2026-08-24', '09:00:00', 'UTC', 'earliest'),
    );
  });

  it('throws on an unknown zone', () => {
    expect(() =>
      resolveLocal('2026-08-24', '09:00:00', 'Mars/Olympus'),
    ).toThrow(/Mars\/Olympus/);
  });

  it('picks the earlier occurrence in a southern-hemisphere zone', () => {
    const millis = resolveLocal('2026-04-05', '02:30:00', 'Australia/Sydney');
    expect(new Date(millis).toISOString()).toBe('2026-04-04T15:30:00.000Z');
  });

  it('handles a 30-minute DST shift', () => {
    const earliest = resolveLocal(
      '2026-04-05',
      '01:45:00',
      'Australia/Lord_Howe',
    );
    const latest = resolveLocal(
      '2026-04-05',
      '01:45:00',
      'Australia/Lord_Howe',
      'latest',
    );
    expect(new Date(earliest).toISOString()).toBe('2026-04-04T14:45:00.000Z');
    expect(new Date(latest).toISOString()).toBe('2026-04-04T15:15:00.000Z');
  });

  it('rejects a zone string that resolves to the server timezone', () => {
    expect(() => resolveLocal('2026-08-24', '09:00:00', 'local')).toThrow(
      /local/,
    );
    expect(() => resolveLocal('2026-08-24', '09:00:00', 'system')).toThrow(
      /system/,
    );
  });

  it('handles a 120-minute DST shift', () => {
    expect(
      new Date(
        resolveLocal('2026-10-25', '02:00:00', 'Antarctica/Troll'),
      ).toISOString(),
    ).toBe('2026-10-25T00:00:00.000Z');
    expect(
      new Date(
        resolveLocal('2026-10-25', '02:00:00', 'Antarctica/Troll', 'latest'),
      ).toISOString(),
    ).toBe('2026-10-25T02:00:00.000Z');
  });

  it('resolves an ambiguous time given with fractional seconds', () => {
    expect(
      new Date(
        resolveLocal('2026-10-25', '02:30:00.000', 'Europe/Berlin', 'latest'),
      ).toISOString(),
    ).toBe('2026-10-25T01:30:00.000Z');
  });

  it('accepts an HH:mm time', () => {
    expect(resolveLocal('2026-08-24', '09:00', 'UTC')).toBe(
      resolveLocal('2026-08-24', '09:00:00', 'UTC'),
    );
  });
});

describe('localDayBounds', () => {
  it('spans 24 hours on an ordinary day', () => {
    const { start, end } = localDayBounds('2026-08-24', 'Europe/Berlin');
    expect(end - start).toBe(86_400_000);
  });

  it('spans 23 hours on a spring-forward day', () => {
    const { start, end } = localDayBounds('2026-03-29', 'Europe/Berlin');
    expect(end - start).toBe(23 * 3_600_000);
  });

  it('spans 25 hours on a fall-back day', () => {
    const { start, end } = localDayBounds('2026-10-25', 'Europe/Berlin');
    expect(end - start).toBe(25 * 3_600_000);
  });

  it('crosses a month boundary for the end bound', () => {
    const { end } = localDayBounds('2026-08-31', 'UTC');
    expect(new Date(end).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('ends at the first of two midnights when the next day falls back', () => {
    // Local 00:00 occurs twice on 2026-11-01 in Havana; the day must end at
    // the first.
    expect(
      new Date(
        localDayBounds('2026-10-31', 'America/Havana').end,
      ).toISOString(),
    ).toBe('2026-11-01T04:00:00.000Z');
  });
});
