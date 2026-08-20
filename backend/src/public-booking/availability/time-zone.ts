import { DateTime, IANAZone } from 'luxon';

/** How to resolve a local time that occurs twice on a DST fall-back day. */
export type AmbiguityPreference = 'earliest' | 'latest';

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

/**
 * Day of week for a calendar date, 0 = Sunday through 6 = Saturday.
 *
 * `chk_availability_day` permits 0-6 without pinning a meaning. This project
 * fixes 0 = Sunday, matching Postgres EXTRACT(DOW) and JavaScript getDay().
 * The admin panel's availability editor must agree.
 *
 * `date` must be a bare `yyyy-MM-dd`; a datetime string is reinterpreted in
 * UTC and can shift the answer by a day.
 */
export function localDayOfWeek(date: string): number {
  const parsed = DateTime.fromISO(date, { zone: 'utc' });
  if (!parsed.isValid) throw new Error(`Invalid date: ${date}`);
  // Luxon numbers weekdays 1 = Monday through 7 = Sunday.
  return parsed.weekday % 7;
}

/**
 * Every calendar date from `from` to `to`, inclusive. Empty if reversed.
 *
 * `from` and `to` must be bare `yyyy-MM-dd`; a datetime string is
 * reinterpreted in UTC and can shift the answer by a day.
 */
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
 * - **Ambiguous** (fall back). 02:30 occurs twice. Luxon gives no
 *   disambiguation guarantee here: which offset it lands on falls out of its
 *   internal guess-and-check, and it picks the *earlier* occurrence in most
 *   northern-hemisphere zones but the *later* one in about a dozen southern
 *   zones (Sydney, Melbourne, Auckland, Santiago, ...). This function
 *   normalizes that away in both directions so `prefer` is always honored
 *   regardless of hemisphere. Callers pass 'latest' for a window's *end* so
 *   that a 09:00-17:00 rule spans the repeated hour instead of closing early.
 *
 * `zone` must be a real IANA zone name (or `'utc'`). Luxon's own `'local'`
 * and `'system'` pseudo-zones are rejected explicitly: they silently resolve
 * to whatever timezone the API server happens to be running in, which would
 * produce plausible-but-wrong availability with no error anywhere.
 */
export function resolveLocal(
  date: string,
  time: string,
  zone: string,
  prefer: AmbiguityPreference = 'earliest',
): number {
  if (!IANAZone.isValidZone(zone)) {
    throw new Error(`Unsupported timezone: ${zone}`);
  }

  const local = `${date}T${normalizeTime(time)}`;
  const parsed = DateTime.fromISO(local, { zone });

  if (!parsed.isValid) {
    throw new Error(
      `Cannot resolve ${local} in zone ${zone}: ${parsed.invalidReason ?? 'unknown'}`,
    );
  }

  const wall = parsed.toFormat(LOCAL_FORMAT);
  const millis = parsed.toMillis();

  // Probe both directions for the occurrence matching `prefer`, rather than
  // trusting luxon's default side. [30, 60, 120] is the complete set of DST
  // transition sizes in tzdb for 2026-2035.
  const direction = prefer === 'latest' ? 1 : -1;
  for (const deltaMinutes of [30, 60, 120]) {
    const candidate = millis + direction * deltaMinutes * 60_000;
    if (
      DateTime.fromMillis(candidate, { zone }).toFormat(LOCAL_FORMAT) === wall
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

/** Tolerates an `HH:mm` time by appending seconds; passes other input through. */
function normalizeTime(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) return `${time}:00`;
  return time;
}
