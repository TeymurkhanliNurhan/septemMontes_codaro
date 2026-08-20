/**
 * The part of this product that is not a booking app.
 *
 * In an ordinary scheduler the customer opens a calendar and picks. Here
 * nobody picks: the date falls out of facts nobody at this company controls —
 * when the person died, whether the coroner has released the body, what the
 * family's tradition requires, and when the last relative can land. This
 * module turns those facts into a window, and records *why* each edge of the
 * window sits where it does so the UI can show its reasoning rather than
 * assert a date.
 *
 * Everything here is pure and instant-based. Nothing reaches the network.
 */

/** Milliseconds in an hour, spelled out so the arithmetic below reads. */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type DispositionKind = 'BURIAL' | 'CREMATION';

export interface Tradition {
	id: string;
	label: string;
	/**
	 * Hours after death by which the committal should have happened. `null`
	 * means the tradition sets no outer deadline.
	 */
	deadlineHours: number | null;
	/**
	 * Hours after death before which the family would not normally hold the
	 * service. Some traditions want the funeral quickly; others expect a wake
	 * of several days first.
	 */
	earliestHours: number;
	/** Shown under the window so the family can see what rule was applied. */
	note: string;
	/** Dispositions this tradition permits, for the intake form's guardrails. */
	disposition: DispositionKind[];
}

export const TRADITIONS: Tradition[] = [
	{
		id: 'ISLAMIC',
		label: 'Islamic',
		deadlineHours: 24,
		earliestHours: 4,
		note: 'Burial is expected as soon as possible, normally before the next sunset.',
		disposition: ['BURIAL']
	},
	{
		id: 'JEWISH',
		label: 'Jewish',
		deadlineHours: 24,
		earliestHours: 4,
		note: 'Burial without delay, and not on Shabbat.',
		disposition: ['BURIAL']
	},
	{
		id: 'CATHOLIC',
		label: 'Catholic',
		deadlineHours: 7 * 24,
		earliestHours: 48,
		note: 'A vigil is usually held first, with the funeral Mass within a week.',
		disposition: ['BURIAL', 'CREMATION']
	},
	{
		id: 'HINDU',
		label: 'Hindu',
		deadlineHours: 24,
		earliestHours: 3,
		note: 'Cremation is expected within a day of death.',
		disposition: ['CREMATION']
	},
	{
		id: 'HUMANIST',
		label: 'Humanist / no tradition',
		deadlineHours: null,
		earliestHours: 48,
		note: 'No religious deadline. The family sets the pace.',
		disposition: ['BURIAL', 'CREMATION']
	}
];

export function traditionById(id: string): Tradition {
	const found = TRADITIONS.find((tradition) => tradition.id === id);
	if (!found) throw new Error(`Unknown tradition: ${id}`);
	return found;
}

/** The facts gathered at intake. Nothing here is a preference. */
export interface CaseFacts {
	/** ISO instant. The anchor every other constraint is measured from. */
	diedAt: string;
	traditionId: string;
	disposition: DispositionKind;
	/**
	 * Whether the coroner has released the body. Until they do, nothing can be
	 * scheduled — this is a legal gate, not a courtesy.
	 */
	coronerInvolved: boolean;
	/** ISO instant. Set (or expected) when `coronerInvolved`. */
	coronerReleaseAt?: string;
	/**
	 * ISO instant the last travelling family member arrives, if the family
	 * asked us to wait for someone. The one soft constraint in the set.
	 */
	familyArrivesAt?: string;
}

export type BoundKind = 'EARLIEST' | 'LATEST';

/** One reason an edge of the window sits where it does. */
export interface Constraint {
	id: string;
	kind: BoundKind;
	/** ISO instant this constraint pushes the bound to. */
	at: string;
	label: string;
	detail: string;
	/**
	 * A hard constraint cannot be negotiated — law, or the body's condition.
	 * A soft one is the family's wish and can be broken if it has to be.
	 */
	hard: boolean;
	/** True when this constraint is the one actually setting the bound. */
	binding?: boolean;
}

export interface FeasibleWindow {
	/** ISO instant. Nothing may be committed before this. */
	earliest: string;
	/** ISO instant. The committal should have happened by this. */
	latest: string;
	/** Every constraint considered, binding ones flagged. */
	constraints: Constraint[];
	/**
	 * True when the constraints contradict each other — the deadline falls
	 * before the earliest possible start. Real, and the case the demo needs to
	 * handle gracefully: it means someone must be told the tradition cannot be
	 * honoured.
	 */
	impossible: boolean;
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

/**
 * How long the home needs between taking the deceased into care and being
 * able to start preparation. Not a rule of law — a fact about the work.
 */
const INTAKE_HOURS = 2;

/**
 * The outer limit on how long a body may be held in the home's cold storage
 * before the family must be told the condition is deteriorating. Sets a hard
 * upper bound even when the tradition sets none.
 */
export const STORAGE_LIMIT_DAYS = 10;

/**
 * Derives the window from the facts. Pure: same facts in, same window out.
 *
 * The rule is simply "the latest of the lower bounds, the earliest of the
 * upper bounds" — but each candidate is kept in `constraints` even when it
 * loses, because the family deserves to see the whole reasoning and not just
 * the answer.
 */
export function computeWindow(facts: CaseFacts): FeasibleWindow {
	const tradition = traditionById(facts.traditionId);
	const died = Date.parse(facts.diedAt);
	const constraints: Constraint[] = [];

	constraints.push({
		id: 'INTAKE',
		kind: 'EARLIEST',
		at: iso(died + INTAKE_HOURS * HOUR),
		label: 'Taken into our care',
		detail: `Preparation cannot begin until the deceased is with us — about ${INTAKE_HOURS} hours after death.`,
		hard: true
	});

	if (tradition.earliestHours > 0) {
		constraints.push({
			id: 'TRADITION_EARLIEST',
			kind: 'EARLIEST',
			at: iso(died + tradition.earliestHours * HOUR),
			label: `${tradition.label} custom`,
			detail: tradition.note,
			hard: false
		});
	}

	if (facts.coronerInvolved) {
		// No release instant means we do not yet know — treat it as unresolved
		// and hold the window open from an unknown point. The UI surfaces this
		// as the reason a plan cannot be confirmed.
		const release = facts.coronerReleaseAt ? Date.parse(facts.coronerReleaseAt) : died + 3 * DAY;
		constraints.push({
			id: 'CORONER',
			kind: 'EARLIEST',
			at: iso(release),
			label: facts.coronerReleaseAt ? 'Coroner released' : 'Coroner release expected',
			detail: facts.coronerReleaseAt
				? 'The body was released to us at this time. Nothing may be scheduled before it.'
				: 'No release yet. This is an estimate, and every plan built on it is provisional.',
			hard: true
		});
	}

	if (facts.familyArrivesAt) {
		constraints.push({
			id: 'FAMILY',
			kind: 'EARLIEST',
			at: facts.familyArrivesAt,
			label: 'Family arriving',
			detail: 'The family asked us to wait for a relative who is travelling.',
			hard: false
		});
	}

	if (tradition.deadlineHours !== null) {
		constraints.push({
			id: 'TRADITION_DEADLINE',
			kind: 'LATEST',
			at: iso(died + tradition.deadlineHours * HOUR),
			label: `${tradition.label} deadline`,
			detail: tradition.note,
			hard: true
		});
	}

	constraints.push({
		id: 'STORAGE',
		kind: 'LATEST',
		at: iso(died + STORAGE_LIMIT_DAYS * DAY),
		label: 'Limit of our care',
		detail: `We can hold the deceased in cold storage for ${STORAGE_LIMIT_DAYS} days.`,
		hard: true
	});

	const lower = constraints.filter((c) => c.kind === 'EARLIEST');
	const upper = constraints.filter((c) => c.kind === 'LATEST');

	const earliestMs = Math.max(...lower.map((c) => Date.parse(c.at)));
	const latestMs = Math.min(...upper.map((c) => Date.parse(c.at)));

	// Flag the winners so the UI can show which fact is actually driving the
	// date, rather than listing five constraints of equal visual weight.
	for (const constraint of lower) {
		constraint.binding = Date.parse(constraint.at) === earliestMs;
	}
	for (const constraint of upper) {
		constraint.binding = Date.parse(constraint.at) === latestMs;
	}

	return {
		earliest: iso(earliestMs),
		latest: iso(latestMs),
		constraints,
		impossible: latestMs <= earliestMs
	};
}

/**
 * Re-derives the window after the coroner moves the release. The cascade the
 * whole product exists for: one fact changes and every date moves with it.
 */
export function withCoronerRelease(facts: CaseFacts, releaseAt: string): CaseFacts {
	return { ...facts, coronerInvolved: true, coronerReleaseAt: releaseAt };
}

/** Human duration for the window's width, e.g. `1 day 4 hours`. */
export function describeSpan(fromIso: string, toIso: string): string {
	const ms = Math.max(0, Date.parse(toIso) - Date.parse(fromIso));
	const days = Math.floor(ms / DAY);
	const hours = Math.floor((ms % DAY) / HOUR);
	const parts: string[] = [];
	if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
	if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
	return parts.length > 0 ? parts.join(' ') : 'under an hour';
}

/**
 * The moment the deceased is actually in our care, which is what the cold
 * storage hold is measured from.
 *
 * This is the latest of the *hard* lower bounds and never the soft ones: a
 * family asking us to wait for a relative does not delay collection, it delays
 * the service. Where a coroner is involved the body is theirs until they
 * release, so intake is the release and not two hours after death.
 */
export function intakeInstant(window: FeasibleWindow): string {
	const hardLower = window.constraints.filter(
		(constraint) => constraint.kind === 'EARLIEST' && constraint.hard
	);
	const at = Math.max(...hardLower.map((constraint) => Date.parse(constraint.at)));
	return new Date(at).toISOString();
}
