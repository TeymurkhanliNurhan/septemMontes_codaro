<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import WindowBand from '$lib/components/funeral/WindowBand.svelte';
	import PlanCard from '$lib/components/funeral/PlanCard.svelte';
	import { api, ApiError } from '$lib/api/client';
	import type { PublicBookingResponse, PublicSlot } from '$lib/api/schemas';
	import { STORAGE_BAYS } from '$lib/funeral/bays';
	import {
		CHAIN,
		solvePlans,
		type NamedResource,
		type Plan,
		type StepAvailability
	} from '$lib/funeral/chain';
	import {
		computeWindow,
		describeSpan,
		intakeInstant,
		traditionById,
		withCoronerRelease,
		type CaseFacts,
		type FeasibleWindow
	} from '$lib/funeral/constraints';
	import {
		loadBoard,
		loadCase,
		newReference,
		pushBoardEntry,
		saveCase,
		type ArrangementCase
	} from '$lib/funeral/case-store';
	import { formatDateInZone, formatInZone } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const zone = $derived(data.organization.timezone);
	const slug = $derived(data.organization.slug);

	/**
	 * Bays free across the hold, first. Two families cannot share one, and a
	 * hold runs for days rather than an hour, so the usual slot machinery does
	 * not apply — the board is the only record of what is occupied.
	 *
	 * A bay is offered even when every one is taken: refusing to plan is worse
	 * than planning and telling the director there is a squeeze.
	 */
	function baysFreeAcross(fromIso: string, toIso: string): NamedResource[] {
		const from = Date.parse(fromIso);
		const to = Date.parse(toIso);
		const taken = new Set(
			loadBoard()
				.filter((entry) => Date.parse(entry.storageFrom) < to && Date.parse(entry.storageTo) > from)
				.map((entry) => entry.bayName)
		);
		const free = STORAGE_BAYS.filter((bay) => !taken.has(bay.name));
		return free.length > 0 ? free : STORAGE_BAYS;
	}

	let record = $state<ArrangementCase | undefined>(undefined);
	let facts = $state<CaseFacts | undefined>(undefined);
	let plans = $state<Plan[]>([]);
	let chosen = $state<Plan | undefined>(undefined);
	let solving = $state(true);
	let solveError = $state<string | undefined>(undefined);
	let confirming = $state(false);
	let confirmError = $state<string | undefined>(undefined);
	/**
	 * Set when the release has been moved, carrying what the service date was
	 * beforehand so the banner can say whether anything actually shifted.
	 */
	let cascade = $state<{ at: string; previousServiceAt?: string } | undefined>(undefined);

	// Read once on mount: sessionStorage is not reactive and the facts do not
	// change underneath us except through the cascade below.
	$effect(() => {
		const loaded = loadCase();
		if (!loaded) {
			void goto(resolve(`/${slug}`));
			return;
		}
		record = loaded;
		facts = loaded.facts;
	});

	const feasible = $derived<FeasibleWindow | undefined>(facts ? computeWindow(facts) : undefined);
	const tradition = $derived(facts ? traditionById(facts.traditionId) : undefined);

	/** Local calendar date in the org zone — what the slot endpoint wants. */
	function localDate(instant: string): string {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(new Date(instant));
	}

	// A fresh solve invalidates any in-flight one; only the newest may land.
	let solveId = 0;

	/**
	 * Fetches real availability for every step across the window and assembles
	 * the candidate chains. Every instant a plan proposes came out of the API,
	 * so confirming is five ordinary bookings and nothing is invented here.
	 */
	async function solve(window: FeasibleWindow): Promise<void> {
		const id = (solveId += 1);
		solving = true;
		solveError = undefined;
		try {
			if (window.impossible) {
				plans = [];
				return;
			}
			const from = localDate(window.earliest);
			const to = localDate(window.latest);

			const availability: StepAvailability[] = await Promise.all(
				data.steps.map(async (step) => {
					const query = new URLSearchParams({ from, to });
					const slots = await api<PublicSlot[]>(
						fetch,
						`/public/orgs/${slug}/services/${step.serviceId}/slots?${query}`
					);
					return {
						role: step.role,
						serviceId: step.serviceId,
						durationMinutes: step.durationMinutes,
						slots,
						resources: step.resources
					};
				})
			);

			if (id !== solveId) return;

			const solved = solvePlans({
				availability,
				earliest: window.earliest,
				latest: window.latest,
				storageBays: baysFreeAcross(intakeInstant(window), window.latest),
				// The bay is held from the moment the deceased is in our care, which
				// is not the same as the first bookable step — that is the point of
				// the row. See `intakeInstant`.
				intakeAt: intakeInstant(window)
			});
			plans = solved;
			chosen = solved[0];
		} catch (cause) {
			if (id !== solveId) return;
			plans = [];
			solveError =
				cause instanceof ApiError ? cause.message : 'We could not reach the schedule just now.';
		} finally {
			if (id === solveId) solving = false;
		}
	}

	$effect(() => {
		if (feasible) void solve(feasible);
	});

	/**
	 * The cascade. A coroner slipping a day is the single most common thing
	 * that happens to a funeral, and it moves every date downstream of it.
	 * One fact changes here and the window and all three plans re-derive.
	 */
	function delayRelease(hours: number): void {
		if (!facts || !record) return;
		const base =
			facts.coronerReleaseAt ?? new Date(Date.parse(facts.diedAt) + 3 * 86_400_000).toISOString();
		const moved = new Date(Date.parse(base) + hours * 3_600_000).toISOString();
		const next = withCoronerRelease(facts, moved);
		cascade = { at: moved, previousServiceAt: plans[0]?.serviceAt };
		facts = next;
		record = { ...record, facts: next };
		saveCase(record);
		chosen = undefined;
	}

	/**
	 * Whether the release actually moved the funeral.
	 *
	 * Often it does not, and that is the more interesting answer: a coroner can
	 * slip a day without touching the date because a vigil custom or a travelling
	 * relative was already holding us later. Saying so is the difference between
	 * a system that reasons about constraints and one that just adds hours.
	 */
	const cascadeEffect = $derived.by(() => {
		if (!cascade || solving) return undefined;
		const now = plans[0]?.serviceAt;
		if (!now || !cascade.previousServiceAt) return undefined;
		if (now === cascade.previousServiceAt) {
			const holding = feasible?.constraints.find(
				(constraint) => constraint.kind === 'EARLIEST' && constraint.binding
			);
			return { moved: false, holding: holding?.label };
		}
		return { moved: true, holding: undefined };
	});

	/**
	 * Books the chain: one POST per step, in order, against the same slots the
	 * plan was solved from. Sequential rather than parallel so a 409 halfway
	 * through tells us exactly which step lost its slot.
	 */
	async function confirm(): Promise<void> {
		if (!chosen || !record || confirming) return;
		confirming = true;
		confirmError = undefined;

		const reference = newReference(record.facts.diedAt, record.decedent.name);
		const payer = record.payer;

		try {
			const booked: PublicBookingResponse[] = [];
			for (const step of chosen.steps) {
				const definition = CHAIN.find((entry) => entry.role === step.role);
				// The public booking API takes one contact per booking, so the
				// arranger is the contact on every step and the rest of the
				// parties travel in the note. The deceased is never a contact.
				const note = [
					`Case ${reference} · step ${definition?.label ?? step.role}`,
					`Deceased: ${record.decedent.name}`,
					`Arranger: ${record.arranger.name}${record.arranger.relation ? ` (${record.arranger.relation})` : ''}`,
					`Account settled by: ${payer ? `${payer.name}${payer.relation ? ` (${payer.relation})` : ''} — ${payer.email}` : record.arranger.name}`,
					`Tradition: ${tradition?.label ?? record.facts.traditionId} · ${record.facts.disposition}`,
					record.wishes ? `Wishes: ${record.wishes}` : undefined
				]
					.filter(Boolean)
					.join('\n');

				const result = await api<PublicBookingResponse>(fetch, `/public/orgs/${slug}/bookings`, {
					method: 'POST',
					body: JSON.stringify({
						serviceId: step.serviceId,
						startsAt: step.startsAt,
						resourceId: step.resourceId,
						customer: {
							name: record.arranger.name,
							email: record.arranger.email,
							phone: record.arranger.phone || undefined
						},
						notes: note.slice(0, 2000)
					})
				});
				booked.push(result);
			}

			const committal = chosen.steps.find((step) => step.role === 'COMMITTAL');
			pushBoardEntry({
				reference,
				decedentName: record.decedent.name,
				arrangerName: record.arranger.name,
				payerName: payer?.name ?? record.arranger.name,
				traditionLabel: tradition?.label ?? record.facts.traditionId,
				bayName: chosen.storage.resourceName,
				storageFrom: chosen.storage.startsAt,
				storageTo: chosen.storage.endsAt,
				serviceAt: chosen.serviceAt,
				committalAt: committal?.startsAt ?? chosen.endsAt,
				committalSite: committal?.resourceName ?? '—',
				awaitingThirdParty: Boolean(committal?.thirdParty),
				provisional: record.facts.coronerInvolved && !record.facts.coronerReleaseAt,
				// `booked` was written in step order, so the ids line up — the
				// console shows the whole chain and not only the two dates a
				// family remembers.
				steps: chosen.steps.map((step, index) => ({
					label: step.label,
					startsAt: step.startsAt,
					endsAt: step.endsAt,
					resourceName: step.resourceName,
					bookingId: booked[index]?.bookingId
				}))
			});

			// `chosen` is a `$state` proxy and `pushState` structured-clones what it
			// is given, so the proxy must be unwrapped or the navigation throws
			// `DataCloneError` — after five bookings have already been written.
			// The bookings are already written by this point, which is exactly when
			// a funeral home starts selling: the family is committed, and the next
			// page knows it.
			await goto(resolve(`/${slug}/extras`), {
				state: {
					reference,
					plan: $state.snapshot(chosen),
					zone,
					bookings: booked,
					decedentName: record.decedent.name
				}
			});
		} catch (cause) {
			if (cause instanceof ApiError && cause.status === 409) {
				confirmError =
					'One of these times was taken while we were talking. We have re-worked the plans below.';
				if (feasible) await solve(feasible);
			} else {
				// The family gets a sentence they can act on; the console gets the
				// cause, because a failure here happens after real bookings have
				// been written and a director needs to know what actually broke.
				console.error('[septem] confirming the arrangement failed', cause);
				confirmError =
					cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.';
			}
		} finally {
			confirming = false;
		}
	}
</script>

{#if record && facts && feasible}
	<a href={resolve(`/${slug}`)} class="mb-6 inline-block link text-sm link-hover opacity-55">
		‹ Change the details
	</a>

	<div class="hairline mb-8 pb-5">
		<p class="eyebrow">Arrangements for</p>
		<h1 class="display mt-1 text-3xl">{record.decedent.name}</h1>
		<p class="mt-2 text-sm opacity-60">
			Died {formatDateInZone(facts.diedAt, zone)}, {formatInZone(facts.diedAt, zone)}
			{#if record.decedent.placeOfDeath}· {record.decedent.placeOfDeath}{/if}
			· {tradition?.label}
			· {facts.disposition === 'BURIAL' ? 'Burial' : 'Cremation'}
		</p>
		<p class="mt-1 text-sm opacity-60">
			Arranged by {record.arranger.name}{record.arranger.relation
				? `, ${record.arranger.relation}`
				: ''}
			· settled by {record.payer?.name ?? record.arranger.name}
		</p>
	</div>

	{#if cascade}
		<div class="settle mb-8 rounded-box border border-warning/40 bg-warning/10 p-4">
			<p class="text-sm leading-relaxed">
				<span class="font-semibold">The release moved.</span>
				The coroner now releases {formatDateInZone(cascade.at, zone)},
				{formatInZone(cascade.at, zone)}.
				{#if cascadeEffect?.moved}
					Every date below has been worked out again from it.
				{:else if cascadeEffect}
					The funeral does not move: {cascadeEffect.holding ?? 'another constraint'} was already holding
					us later than the coroner was.
				{:else}
					Working the dates out again.
				{/if}
			</p>
		</div>
	{/if}

	<WindowBand window={feasible} {zone} />

	<div class="hairline mt-14 pb-3">
		<p class="eyebrow">What fits inside it</p>
		<h2 class="display mt-1 text-2xl">
			{#if solving}
				Working it out…
			{:else if plans.length === 0}
				Nothing fits
			{:else}
				{plans.length} way{plans.length === 1 ? '' : 's'} this can be done
			{/if}
		</h2>
		<p class="mt-1 max-w-2xl text-sm leading-relaxed opacity-60">
			{#if plans.some((plan) => plan.omitted.length > 0)}
				The window will not hold a whole arrangement, so what is below is shortened, and each one
				says what it had to leave out. You are choosing between these, not between times.
			{:else}
				Each one is a whole arrangement — the preparation, the viewing, the service, the journey and
				the committal, with the rooms and the cars they need. You are choosing between these, not
				between times.
			{/if}
		</p>
	</div>

	<div class="mt-6">
		{#if solving}
			<div class="flex justify-center py-16">
				<span class="loading loading-lg loading-spinner opacity-40"></span>
			</div>
		{:else if solveError}
			<div role="alert" class="alert alert-error"><span>{solveError}</span></div>
		{:else if feasible.impossible}
			<div class="rounded-box bg-base-200 p-8">
				<p class="display text-lg">These constraints cannot all be honoured.</p>
				<p class="mt-2 max-w-xl text-sm leading-relaxed opacity-65">
					The deadline the tradition sets falls before the earliest moment anything could begin.
					This is not a fault in the arrangement — it happens, and it is a conversation to have with
					a person rather than a form. A director will call {record.arranger.name} today.
				</p>
			</div>
		{:else if plans.length === 0}
			<div class="rounded-box bg-base-200 p-8">
				<p class="display text-lg">There is no room inside the window.</p>
				<p class="mt-2 max-w-xl text-sm leading-relaxed opacity-65">
					{describeSpan(feasible.earliest, feasible.latest)} is not enough for even the shortest arrangement
					we can offer — or what is left of it is already committed to another family. This is a conversation
					to have with a person: a director will telephone
					{record.arranger.name} today, and between us we will find what can move.
				</p>
			</div>
		{:else}
			<div class="space-y-6">
				{#each plans as plan (plan.id)}
					<PlanCard
						{plan}
						{zone}
						selected={chosen?.id === plan.id}
						onselect={(value) => (chosen = value)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	{#if confirmError}
		<div role="alert" class="mt-6 alert alert-warning"><span>{confirmError}</span></div>
	{/if}

	{#if chosen}
		<div class="settle sticky bottom-0 mt-10 border-t-2 border-base-content bg-base-100 py-5">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<p class="text-sm">
					<span class="opacity-55">Chosen:</span>
					{chosen.title} · service {formatDateInZone(chosen.serviceAt, zone)},
					{formatInZone(chosen.serviceAt, zone)}
				</p>
				<button class="btn btn-primary" disabled={confirming} onclick={confirm}>
					{#if confirming}<span class="loading loading-sm loading-spinner"></span>{/if}
					{confirming ? 'Holding these…' : 'Hold this arrangement'}
				</button>
			</div>
		</div>
	{/if}

	<!--
		The one thing on this page that is for a demonstration rather than for a
		family: the cascade. It is kept visually apart, below everything, so it
		reads as a tool and never as an action the family is being invited to take.
	-->
	<div class="mt-16 rounded-box border border-dashed border-base-300 p-4">
		<p class="eyebrow">The only demo button on this site</p>
		<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
			A coroner slipping a day is the single most common thing that happens to a funeral, and it
			drags five bookings and a refrigerated bay along behind it. Press one and watch the window
			re-derive. Sometimes the funeral does not move at all, and the app will tell you which
			constraint was already holding it later — that answer is the point of the whole thing.
		</p>
		<div class="mt-3 flex flex-wrap gap-3">
			<button class="btn btn-outline btn-sm" onclick={() => delayRelease(24)}>
				Release delayed a day
			</button>
			<button class="btn btn-outline btn-sm" onclick={() => delayRelease(72)}>
				Release delayed three days
			</button>
			<button class="btn btn-outline btn-sm" onclick={() => delayRelease(-24)}>
				Released a day early
			</button>
		</div>
	</div>
{:else}
	<div class="flex justify-center py-24">
		<span class="loading loading-lg loading-spinner opacity-40"></span>
	</div>
{/if}
