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
