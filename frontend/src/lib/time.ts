/**
 * Date-range and timezone helpers for the booking UI.
 *
 * The backend does the hard conversions — these only format instants the API
 * already produced, so `Intl.DateTimeFormat` is enough and there is no luxon
 * here.
 */

/** The seven-day window starting on `date`, as the API's `from`/`to` pair. */
export function weekFrom(date: string): { from: string; to: string } {
	const from = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(from.getTime())) {
		throw new Error(`Invalid date: ${date}`);
	}
	const to = new Date(from);
	to.setUTCDate(to.getUTCDate() + 6);
	return { from: date, to: to.toISOString().slice(0, 10) };
}

/** Renders a UTC instant as `HH:mm` in the given IANA zone. */
export function formatInZone(instant: string, zone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(new Date(instant));
}

/** Renders a UTC instant as `Thu 24 Aug 2026` in the given IANA zone. */
export function formatDateInZone(instant: string, zone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(instant));
}

/**
 * The `datetime-local` value for an instant, read in the given zone.
 *
 * The director's console is the home's own screen: the times on it are the
 * home's, whatever zone the machine happens to be in. An editable time
 * therefore has to be shown — and read back — in the organization's zone, or
 * a director in Warsaw editing from a laptop still on London time moves every
 * funeral by an hour without being told.
 */
export function toZonedInput(instant: string, zone: string): string {
	const parts = zonedParts(new Date(instant), zone);
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The inverse: a wall-clock time in `zone` back to a UTC instant. */
export function fromZonedInput(local: string, zone: string): string {
	const asUtc = Date.parse(`${local}:00.000Z`);
	if (Number.isNaN(asUtc)) {
		throw new Error(`Invalid local time: ${local}`);
	}
	// Two passes. The first uses the offset in force at the wall time read as
	// UTC, which is right all but two days a year; the second re-reads the
	// offset at the instant that produced, which is what gets the hour right
	// on the days the clocks go back.
	const firstPass = asUtc - zoneOffsetMs(new Date(asUtc), zone);
	return new Date(asUtc - zoneOffsetMs(new Date(firstPass), zone)).toISOString();
}

function zonedParts(date: Date, zone: string): Record<string, string> {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: zone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(date);

	const named: Record<string, string> = {};
	for (const part of parts) {
		if (part.type !== 'literal') named[part.type] = part.value;
	}
	return named;
}

/** How far ahead of UTC `zone` is at `date`, in milliseconds. */
function zoneOffsetMs(date: Date, zone: string): number {
	const parts = zonedParts(date, zone);
	const wallAsUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second)
	);
	// The parts carry no milliseconds, so they come off both sides.
	return wallAsUtc - (date.getTime() - date.getMilliseconds());
}

/** Minimal shape shared by every slot the API returns. */
export interface SlotLike {
	startsAt: string;
	endsAt: string;
	resourceIds: string[];
}

/** Local calendar date (`yyyy-MM-dd`) of an instant in the given zone. */
function localDateOf(instant: string, zone: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: zone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(instant));
}

/** Today's calendar date in the given zone, for the week pager's floor. */
export function todayInZone(zone: string): string {
	return localDateOf(new Date().toISOString(), zone);
}

/**
 * Buckets slots by their local calendar date in the organization's zone, so
 * the grid renders one column per day with each slot on the day the consumer
 * sees it.
 */
export function groupSlotsByLocalDay(slots: SlotLike[], zone: string): Map<string, SlotLike[]> {
	const grouped = new Map<string, SlotLike[]>();
	for (const slot of slots) {
		const day = localDateOf(slot.startsAt, zone);
		const bucket = grouped.get(day);
		if (bucket) {
			bucket.push(slot);
		} else {
			grouped.set(day, [slot]);
		}
	}
	return grouped;
}
