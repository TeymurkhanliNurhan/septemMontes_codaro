/**
 * A funeral is not an appointment. It is five dependent bookings across six
 * kinds of resource, and the family chooses between whole *plans* rather than
 * between times.
 *
 * This module takes the real availability the API advertises for each step and
 * assembles it into candidate chains that fit inside the window
 * `constraints.ts` derived. Every instant a plan proposes is a slot the
 * backend actually offered, so confirming a plan is five ordinary POSTs and
 * nothing here has to be trusted twice.
 *
 * The one row that is not a slot is cold storage: the deceased occupies a bay
 * continuously from intake until the committal, days rather than minutes. It
 * is derived from the chain's span rather than solved for, because there is
 * nothing to choose — the bay is held for as long as the family needs.
 */
import type { PublicSlot } from '$lib/api/schemas';

const MINUTE = 60_000;

export type StepRole = 'PREPARATION' | 'VIEWING' | 'SERVICE' | 'TRANSPORT' | 'COMMITTAL';

export interface StepDefinition {
	role: StepRole;
	/** The service name as seeded, used to match the API's service list. */
	serviceName: string;
	/** What the family is told this step is. */
	label: string;
	blurb: string;
	/** Shortest acceptable gap after the previous step ends, in minutes. */
	minGapMinutes: number;
	/**
	 * The gap past which the plan is worth flagging — a four-hour wait between
	 * the service and the committal is feasible and also unkind.
	 */
	comfortableGapMinutes: number;
}

/**
 * The chain, in order. Gaps are the real reasons, not padding: the deceased
 * rests after preparation, the chapel is reset between the viewing and the
 * service, and the cortège leaves for the committal directly.
 */
export const CHAIN: StepDefinition[] = [
	{
		role: 'PREPARATION',
		serviceName: 'Preparation',
		label: 'Preparation',
		blurb: 'Washing, dressing and preparation, in our care.',
		minGapMinutes: 0,
		comfortableGapMinutes: 24 * 60
	},
	{
		role: 'VIEWING',
		serviceName: 'Viewing',
		label: 'Viewing',
		blurb: 'Private time for the family, before the service.',
		minGapMinutes: 60,
		comfortableGapMinutes: 24 * 60
	},
	{
		role: 'SERVICE',
		serviceName: 'Funeral Service',
		label: 'Service',
		blurb: 'The service itself.',
		minGapMinutes: 30,
		comfortableGapMinutes: 4 * 60
	},
	{
		role: 'TRANSPORT',
		serviceName: 'Transport',
		label: 'Transport',
		blurb: 'Hearse and bearers, to the place of committal.',
		minGapMinutes: 0,
		comfortableGapMinutes: 60
	},
	{
		role: 'COMMITTAL',
		serviceName: 'Committal',
		label: 'Committal',
		blurb: 'Burial or cremation.',
		minGapMinutes: 0,
		comfortableGapMinutes: 60
	}
];

/** A resource as the family sees it on the timeline. */
export interface NamedResource {
	id: string;
	name: string;
	resourceType?: string | null;
}

/** Availability for one step, as fetched. */
export interface StepAvailability {
	role: StepRole;
	serviceId: string;
	durationMinutes: number;
	slots: PublicSlot[];
	/** Resources this step may run on, by id. */
	resources: NamedResource[];
}

/** One placed step in a solved chain. */
export interface PlannedStep {
	role: StepRole;
	label: string;
	blurb: string;
	serviceId: string;
	startsAt: string;
	endsAt: string;
	resourceId: string;
	resourceName: string;
	/** Minutes of dead time before this step. Rendered, not hidden. */
	gapBeforeMinutes: number;
	/** True when that gap is longer than the family should be asked to wait. */
	longGap: boolean;
	/** True when the committal site is a third party and must confirm. */
	thirdParty: boolean;
}

/** The continuously-held row. Not a slot, and deliberately not solved for. */
export interface StorageHold {
	resourceId: string;
	resourceName: string;
	startsAt: string;
	endsAt: string;
	days: number;
}

export interface Plan {
	id: string;
	title: string;
	rationale: string;
	steps: PlannedStep[];
	storage: StorageHold;
	/** Start of the first step and end of the last. */
	startsAt: string;
	endsAt: string;
	/** The instant the family will think of as "the funeral". */
	serviceAt: string;
	/** Notes worth showing on the card: long waits, reserve hearse, and so on. */
	warnings: string[];
	/**
	 * Steps this plan had to leave out to fit the window. Empty for a full
	 * arrangement; never hidden when it is not.
	 */
	omitted: StepRole[];
}

export interface SolveInput {
	availability: StepAvailability[];
	/** ISO instant. No step may start before this. */
	earliest: string;
	/** ISO instant. The committal must end by this. */
	latest: string;
	/** Cold storage bays, in preference order. */
	storageBays: NamedResource[];
	/** ISO instant the deceased comes into our care. */
	intakeAt: string;
}

/**
 * How a plan is biased. The family is never asked to pick a time, but they
 * are asked to pick a shape: as soon as possible, or with room to breathe.
 */
export interface Strategy {
	id: string;
	title: string;
	rationale: string;
	/** Minutes to push the search start past the window's earliest edge. */
	offsetMinutes: number;
	/** Resource names to prefer where a step offers a choice. */
	prefer?: string[];
}

export const STRATEGIES: Strategy[] = [
	{
		id: 'soonest',
		title: 'The soonest we can',
		rationale: 'Everything at the first moment the constraints allow it.',
		offsetMinutes: 0
	},
	{
		id: 'unhurried',
		title: 'A day to gather',
		rationale: 'A full day between the preparation and the service, so people can travel.',
		offsetMinutes: 20 * 60
	},
	{
		id: 'quiet',
		title: 'Small and quiet',
		rationale: 'The small chapel, for a service of two dozen rather than eighty.',
		offsetMinutes: 0,
		prefer: ['Small Chapel']
	}
];

function minutesBetween(fromIso: string, toIso: string): number {
	return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MINUTE);
}

/**
 * Picks the resource a step runs on. Preference wins when the slot offers it;
 * otherwise the first resource the slot is free on, which keeps the chain
 * solvable rather than failing on a cosmetic wish.
 */
function chooseResource(
	slot: PublicSlot,
	resources: NamedResource[],
	prefer: string[] | undefined
): NamedResource | undefined {
	const available = resources.filter((resource) => slot.resourceIds.includes(resource.id));
	if (available.length === 0) return undefined;
	if (prefer) {
		const preferred = available.find((resource) => prefer.includes(resource.name));
		if (preferred) return preferred;
	}
	// The API returns capable resources in no meaningful order, so a spare is as
	// likely to come back first as the one the home would actually send. Rank
	// reserves last, then take the first — otherwise a plan claims the reserve
	// hearse while the main car sits free, which is both wrong and alarming.
	const ranked = [...available].sort((left, right) => {
		const byReserve = Number(isReserve(left)) - Number(isReserve(right));
		return byReserve !== 0 ? byReserve : left.name.localeCompare(right.name);
	});
	return ranked[0];
}

/** A resource the home keeps for when the first choice is committed. */
function isReserve(resource: NamedResource): boolean {
	return /reserve|spare/i.test(resource.name);
}

/**
 * Greedy forward pass: place each step at the first slot that clears the
 * previous step's end plus its minimum gap, and never past the window.
 *
 * Greedy is right here rather than merely cheap — the chain is a strict
 * sequence with no alternatives to backtrack into, so the earliest feasible
 * placement of step N never rules out a placement of step N+1 that a later
 * one would have allowed.
 */
function solveOne(
	input: SolveInput,
	strategy: Strategy,
	chain: StepDefinition[]
): Plan | undefined {
	const windowEnd = Date.parse(input.latest);
	let cursor = Date.parse(input.earliest) + strategy.offsetMinutes * MINUTE;

	const steps: PlannedStep[] = [];

	for (const definition of chain) {
		const availability = input.availability.find((entry) => entry.role === definition.role);
		if (!availability) return undefined;

		const notBefore = cursor + definition.minGapMinutes * MINUTE;
		const candidate = availability.slots.find((slot) => {
			const start = Date.parse(slot.startsAt);
			return (
				start >= notBefore &&
				Date.parse(slot.endsAt) <= windowEnd &&
				chooseResource(slot, availability.resources, strategy.prefer) !== undefined
			);
		});
		if (!candidate) return undefined;

		const resource = chooseResource(candidate, availability.resources, strategy.prefer);
		if (!resource) return undefined;

		const previousEnd = steps.length > 0 ? steps[steps.length - 1].endsAt : input.earliest;
		const gap = minutesBetween(previousEnd, candidate.startsAt);

		steps.push({
			role: definition.role,
			label: definition.label,
			blurb: definition.blurb,
			serviceId: availability.serviceId,
			startsAt: candidate.startsAt,
			endsAt: candidate.endsAt,
			resourceId: resource.id,
			resourceName: resource.name,
			gapBeforeMinutes: Math.max(0, gap),
			longGap: gap > definition.comfortableGapMinutes,
			thirdParty: resource.resourceType === 'COMMITTAL'
		});

		cursor = Date.parse(candidate.endsAt);
	}

	const first = steps[0];
	const last = steps[steps.length - 1];
	const service = steps.find((step) => step.role === 'SERVICE') ?? first;

	// The bay is held from intake, not from the first step — the deceased is in
	// our care from the moment we collect them, whatever the chapel is doing.
	const holdStart = input.intakeAt;
	const holdEnd = last.endsAt;
	const bay = input.storageBays[0];
	if (!bay) return undefined;

	const warnings: string[] = [];
	for (const step of steps) {
		if (step.longGap) {
			const hours = Math.round(step.gapBeforeMinutes / 60);
			warnings.push(
				`${hours} hours between the previous step and the ${step.label.toLowerCase()}.`
			);
		}
	}
	for (const step of steps) {
		// Reached only when `chooseResource` ranked a reserve first, which it does
		// only when every primary is busy in that slot — so this says what it means.
		if (isReserve({ id: step.resourceId, name: step.resourceName })) {
			warnings.push(`Uses ${step.resourceName} — our first choice is committed at that hour.`);
		}
	}
	const committal = steps.find((step) => step.role === 'COMMITTAL');
	if (committal?.thirdParty) {
		warnings.push(
			`${committal.resourceName} is a third party and must confirm the slot themselves.`
		);
	}

	const omitted = CHAIN.filter(
		(definition) => !chain.some((entry) => entry.role === definition.role)
	).map((definition) => definition.role);

	for (const definition of CHAIN) {
		if (!omitted.includes(definition.role)) continue;
		warnings.push(
			`No ${definition.label.toLowerCase()} — there is not room for one inside the window.`
		);
	}

	return {
		id: chain.length === CHAIN.length ? strategy.id : `${strategy.id}-short`,
		title: omitted.length === 0 ? strategy.title : `${strategy.title}, shortened`,
		rationale:
			omitted.length === 0
				? strategy.rationale
				: `${strategy.rationale} The window is too narrow for the whole of it.`,
		omitted,
		steps,
		storage: {
			resourceId: bay.id,
			resourceName: bay.name,
			startsAt: holdStart,
			endsAt: holdEnd,
			days: Math.max(1, Math.ceil(minutesBetween(holdStart, holdEnd) / (60 * 24)))
		},
		startsAt: first.startsAt,
		endsAt: last.endsAt,
		serviceAt: service.startsAt,
		warnings
	};
}

/**
 * Solves every strategy and drops the ones that do not fit, plus any that
 * landed on exactly the same chain as an earlier one — offering the family two
 * identical plans under different names would be a lie about their choices.
 */
/**
 * The chain, and then the chains a home falls back to when the window is too
 * narrow for all of it.
 *
 * A tradition that asks for burial within a day, plus a coroner who releases
 * in the afternoon, can leave six hours for five steps. A real funeral
 * director does not refuse — they drop the viewing, and if they must, hold the
 * service at the graveside. Both are worse than the full arrangement and both
 * are far better than nothing, so they are offered in that order and always
 * labelled with what is missing.
 */
const REDUCTIONS: StepDefinition[][] = [
	CHAIN,
	CHAIN.filter((step) => step.role !== 'VIEWING'),
	CHAIN.filter((step) => step.role !== 'VIEWING' && step.role !== 'SERVICE')
];

export function solvePlans(input: SolveInput): Plan[] {
	const plans: Plan[] = [];
	const seen = new Set<string>();
	for (const strategy of STRATEGIES) {
		// Longest chain that fits wins; a strategy never contributes both a full
		// arrangement and a shortened one.
		let plan: Plan | undefined;
		for (const chain of REDUCTIONS) {
			plan = solveOne(input, strategy, chain);
			if (plan) break;
		}
		if (!plan) continue;
		const fingerprint = plan.steps.map((step) => `${step.startsAt}@${step.resourceId}`).join('|');
		if (seen.has(fingerprint)) continue;
		seen.add(fingerprint);
		plans.push(plan);
	}
	return plans;
}
