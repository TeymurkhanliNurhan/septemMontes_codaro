import { DateTime } from 'luxon';

/** How to resolve a local time that occurs twice on a DST fall-back day. */
export type AmbiguityPreference = 'earliest' | 'latest';

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const DAY_MS = 86_400_000;

/**
 * Day of week for a calendar date, 0 = Sunday through 6 = Saturday.
 *
 * `chk_availability_day` permits 0-6 without pinning a meaning. This project
 * fixes 0 = Sunday, matching Postgres EXTRACT(DOW) and JavaScript getDay().
 * The admin panel's availability editor must agree.
 */
export function localDayOfWeek(date: string): number {
  const parsed = DateTime.fromISO(date, { zone: 'utc' });
  if (!parsed.isValid) throw new Error(`Invalid date: ${date}`);
  // Luxon numbers weekdays 1 = Monday through 7 = Sunday.
  return parsed.weekday % 7;
}

/** Every calendar date from `from` to `to`, inclusive. Empty if reversed. */
export function eachLocalDate(from: string, to: string): string[] {
  const start = DateTime.fromISO(from, { zone: 'utc' });
  const end = DateTime.fromISO(to, { zone: 'utc' });
  if (!start.isValid) throw new Error(`Invalid date: ${from}`);
  if (!end.isValid) throw new Error(`Invalid date: ${to}`);

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    dates.push(cursor.toFormat('yyyy-MM-dd'));
  }
  return dates;
}

/**
 * Converts a local wall-clock time on a calendar date into a UTC instant.
 *
 * Two DST cases are resolved deliberately rather than left to library default:
 *
 * - **Non-existent** (spring forward). 02:30 does not occur on a day the clock
 *   jumps 02:00 to 03:00. Luxon shifts such a time forward by the offset, so
 *   02:30 resolves to 03:30 local. A window boundary therefore survives the
 *   gap rather than vanishing. Only a business open across 02:00 can reach
 *   this case at all. Pinned by test rather than assumed.
 * - **Ambiguous** (fall back). 02:30 occurs twice. Luxon returns the earlier
 *   offset. Callers pass 'latest' for a window's *end* so that a 09:00-17:00
 *   rule spans the repeated hour instead of closing early.
 */
export function resolveLocal(
  date: string,
  time: string,
  zone: string,
  prefer: AmbiguityPreference = 'earliest',
): number {
  const local = `${date}T${normalizeTime(time)}`;
  const parsed = DateTime.fromISO(local, { zone });

  if (!parsed.isValid) {
    throw new Error(
      `Cannot resolve ${local} in zone ${zone}: ${parsed.invalidReason ?? 'unknown'}`,
    );
  }

  const millis = parsed.toMillis();
  if (prefer === 'earliest') return millis;

  // A later occurrence exists only if shifting forward by the offset delta
  // renders to the same local string. Probe the shift sizes real zones use.
  for (const deltaMinutes of [30, 60, 120]) {
    const candidate = millis + deltaMinutes * 60_000;
    if (
      DateTime.fromMillis(candidate, { zone }).toFormat(LOCAL_FORMAT) === local
    ) {
      return candidate;
    }
  }

  return millis;
}

/** Midnight-to-midnight bounds of a local date, as UTC instants. */
export function localDayBounds(
  date: string,
  zone: string,
): { start: number; end: number } {
  const start = resolveLocal(date, '00:00:00', zone, 'earliest');
  const next = DateTime.fromISO(date, { zone: 'utc' })
    .plus({ days: 1 })
    .toFormat('yyyy-MM-dd');
  return { start, end: resolveLocal(next, '00:00:00', zone, 'earliest') };
}

/** Postgres `time` columns arrive as HH:mm:ss; tolerate HH:mm too. */
function normalizeTime(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) return `${time}:00`;
  return time;
}

export { DAY_MS };
