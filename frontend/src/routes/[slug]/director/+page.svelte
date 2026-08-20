<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { logout } from '$lib/api/auth';
	import { STORAGE_BAYS } from '$lib/funeral/bays';
	import {
		loadBoard,
		newReference,
		pushBoardEntry,
		removeBoardEntry,
		resetBoard,
		seedBoardOnce,
		updateBoardEntry,
		type BoardEntry,
		type BoardStep
	} from '$lib/funeral/case-store';
	import { STORAGE_LIMIT_DAYS, TRADITIONS, traditionById } from '$lib/funeral/constraints';
	import { committalSites, groupResources } from '$lib/funeral/inventory';
	import { formatDateInZone, formatInZone, fromZonedInput, toZonedInput } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const zone = $derived(data.organization.timezone);

	let signingOut = $state(false);

	async function signOut(): Promise<void> {
		if (signingOut) return;
		signingOut = true;
		try {
			await logout(fetch);
		} finally {
			// Whether or not the API acknowledged it, leave the console: a director
			// stepping away from a shared screen must not be kept on it by an error.
			await goto(resolve(`/${data.organization.slug}/director/login`), { invalidateAll: true });
		}
	}

	/**
	 * Cases the home is carrying today. Seeded ones stand for the work already
	 * in the building; anything the family flow confirmed is appended to them,
	 * so a demonstration shows a board under load rather than an empty one.
	 *
	 * They are written onto the board once and then belong to it — a director
	 * amends and removes them like any other case.
	 */
	function seeded(): BoardEntry[] {
		const now = Date.now();
		const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
		return [
			{
				reference: '2026-KOW-118',
				decedentName: 'Halina Kowalczyk',
				arrangerName: 'Marta Kowalczyk',
				payerName: 'Estate of H. Kowalczyk',
				traditionLabel: 'Catholic',
				bayName: 'Cold Storage Bay 1',
				storageFrom: at(-7 * 24),
				storageTo: at(28),
				serviceAt: at(26),
				committalAt: at(28),
				committalSite: 'Bródno Cemetery — plot',
				awaitingThirdParty: false,
				provisional: false,
				steps: chainAround(
					at(26),
					at(28),
					'Chapel of Rest',
					'Hearse — Warsaw',
					'Bródno Cemetery — plot'
				)
			},
			{
				reference: '2026-AN-042',
				decedentName: 'Amir Nazari',
				arrangerName: 'Leila Nazari',
				payerName: 'Leila Nazari',
				traditionLabel: 'Islamic',
				bayName: 'Cold Storage Bay 2',
				storageFrom: at(-9),
				storageTo: at(8),
				serviceAt: at(6),
				committalAt: at(8),
				committalSite: 'Bródno Cemetery — plot',
				awaitingThirdParty: true,
				provisional: false,
				steps: chainAround(
					at(6),
					at(8),
					'Small Chapel',
					'Hearse — Warsaw',
					'Bródno Cemetery — plot'
				)
			},
			{
				reference: '2026-JW-507',
				decedentName: 'Jan Wiśniewski',
				arrangerName: 'Piotr Wiśniewski',
				payerName: 'Piotr Wiśniewski',
				traditionLabel: 'Humanist / no tradition',
				bayName: 'Cold Storage Bay 3',
				storageFrom: at(-9 * 24),
				storageTo: at(20),
				serviceAt: at(18),
				committalAt: at(20),
				committalSite: 'Northern Crematorium — retort',
				awaitingThirdParty: true,
				provisional: true,
				steps: chainAround(
					at(18),
					at(20),
					'Chapel of Rest',
					'Hearse — Reserve',
					'Northern Crematorium — retort'
				)
			}
		];
	}

	/** The ordinary shape of a chain, hung off the two dates that matter. */
	function chainAround(
		serviceAt: string,
		committalAt: string,
		chapel: string,
		hearse: string,
		site: string
	): BoardStep[] {
		const service = Date.parse(serviceAt);
		const span = (fromMs: number, minutes: number) => ({
			startsAt: new Date(fromMs).toISOString(),
			endsAt: new Date(fromMs + minutes * 60_000).toISOString()
		});
		return [
			{
				label: 'Preparation',
				...span(service - 26 * 3_600_000, 120),
				resourceName: 'Preparation Room'
			},
			{ label: 'Viewing', ...span(service - 2 * 3_600_000, 60), resourceName: chapel },
			{ label: 'Service', ...span(service, 60), resourceName: chapel },
			{ label: 'Transport', ...span(service + 60 * 60_000, 60), resourceName: hearse },
			{ label: 'Committal', ...span(Date.parse(committalAt), 60), resourceName: site }
		];
	}

	// Derived rather than an effect so the board is there for the first paint
	// in the browser, and written to directly whenever a director amends one.
	let board = $derived.by(() => seedBoardOnce(seeded()));

	/** Soonest committal first: the case the home is working on now is at the top. */
	const cases = $derived(
		[...board].sort((left, right) => Date.parse(left.committalAt) - Date.parse(right.committalAt))
	);

	/** Days already spent in the bay, against the limit of our care. */
	function daysHeld(entry: BoardEntry): number {
		return Math.max(0, Math.floor((Date.now() - Date.parse(entry.storageFrom)) / 86_400_000));
	}

	function pressure(entry: BoardEntry): 'ok' | 'watch' | 'urgent' {
		const held = daysHeld(entry);
		if (held >= STORAGE_LIMIT_DAYS - 1) return 'urgent';
		if (held >= STORAGE_LIMIT_DAYS - 4) return 'watch';
		return 'ok';
	}

	const bays = $derived(
		STORAGE_BAYS.map((bay) => {
			// `cases` is sorted by committal, so the first is the one leaving
			// soonest. A second in the same bay is a clash, and the console says
			// so rather than quietly rendering one of them.
			const held = cases.filter((entry) => entry.bayName === bay.name);
			return { name: bay.name, entry: held[0], clashes: held.length - 1 };
		})
	);

	const awaiting = $derived(cases.filter((entry) => entry.awaitingThirdParty));
	const provisional = $derived(cases.filter((entry) => entry.provisional));
	const baysFree = $derived(bays.filter((bay) => !bay.entry).length);
	const nearingLimit = $derived(cases.filter((entry) => pressure(entry) !== 'ok').length);

	const figures = $derived([
		{ label: 'In our care', value: cases.length, tone: '' },
		{ label: 'Bays free', value: baysFree, tone: baysFree === 0 ? 'text-error' : '' },
		{ label: 'Waiting on a site', value: awaiting.length, tone: '' },
		{
			label: 'Nearing the limit',
			value: nearingLimit,
			tone: nearingLimit > 0 ? 'text-warning' : ''
		}
	]);

	let opened = $state<string | undefined>(undefined);

	function toggle(reference: string): void {
		opened = opened === reference ? undefined : reference;
	}

	/**
	 * What the building is actually doing next. The board is sorted by
	 * committal, which is the right order for planning and the wrong one for
	 * the morning: a preparation at eight belongs above a committal at four,
	 * even though its case does not.
	 */
	const agenda = $derived.by(() => {
		const now = Date.now();
		const until = now + 48 * 3_600_000;
		const items = [];

		for (const entry of cases) {
			// A case carried over from before the board kept its chain still has
			// the two moments a family would name.
			const steps: BoardStep[] = entry.steps ?? [
				{
					label: 'Service',
					startsAt: entry.serviceAt,
					endsAt: entry.serviceAt,
					resourceName: '—'
				},
				{
					label: 'Committal',
					startsAt: entry.committalAt,
					endsAt: entry.committalAt,
					resourceName: entry.committalSite
				}
			];
			for (const step of steps) {
				const at = Date.parse(step.startsAt);
				if (at < now || at > until) continue;
				items.push({ ...step, entry, key: `${entry.reference}:${step.label}` });
			}
		}

		return items.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
	});

	const inventoryGroups = $derived(groupResources(data.services));
	const sites = $derived(committalSites(data.services));

	/* Amending a case. */

	interface EditForm {
		reference: string;
		decedentName: string;
		arrangerName: string;
		payerName: string;
		traditionLabel: string;
		bayName: string;
		storageFromLocal: string;
		storageToLocal: string;
		serviceAtLocal: string;
		committalAtLocal: string;
		committalSite: string;
		awaitingThirdParty: boolean;
		provisional: boolean;
	}

	let dialog = $state<HTMLDialogElement>();
	let form = $state<EditForm | undefined>(undefined);
	let formError = $state<string | undefined>(undefined);
	let confirmingRemoval = $state(false);
	/** True while the dialog is taking a case rather than amending one. */
	let taking = $state(false);

	/**
	 * A case that arrived by telephone. Most of them do — a hospital rings at
	 * four in the morning and the family fills nothing in — so the console can
	 * open one without the family flow having run at all.
	 */
	function takeACase(): void {
		const now = Date.now();
		const hours = (count: number) => new Date(now + count * 3_600_000).toISOString();
		form = {
			reference: '',
			decedentName: '',
			arrangerName: '',
			payerName: '',
			traditionLabel: traditionById('CATHOLIC').label,
			bayName: bays.find((bay) => !bay.entry)?.name ?? STORAGE_BAYS[0].name,
			storageFromLocal: toZonedInput(hours(2), zone),
			storageToLocal: toZonedInput(hours(72), zone),
			serviceAtLocal: toZonedInput(hours(50), zone),
			committalAtLocal: toZonedInput(hours(52), zone),
			committalSite: sites[0] ?? '—',
			// Nothing is agreed with the site until somebody telephones them.
			awaitingThirdParty: true,
			provisional: false
		};
		formError = undefined;
		confirmingRemoval = false;
		taking = true;
		dialog?.showModal();
	}

	function amend(entry: BoardEntry): void {
		taking = false;
		form = {
			reference: entry.reference,
			decedentName: entry.decedentName,
			arrangerName: entry.arrangerName,
			payerName: entry.payerName,
			traditionLabel: entry.traditionLabel,
			bayName: entry.bayName,
			storageFromLocal: toZonedInput(entry.storageFrom, zone),
			storageToLocal: toZonedInput(entry.storageTo, zone),
			serviceAtLocal: toZonedInput(entry.serviceAt, zone),
			committalAtLocal: toZonedInput(entry.committalAt, zone),
			committalSite: entry.committalSite,
			awaitingThirdParty: entry.awaitingThirdParty,
			provisional: entry.provisional
		};
		formError = undefined;
		confirmingRemoval = false;
		dialog?.showModal();
	}

	function save(event: SubmitEvent): void {
		event.preventDefault();
		if (!form) return;

		if (!form.decedentName.trim() || !form.arrangerName.trim()) {
			formError = 'A case needs the name of the deceased and of the person arranging it.';
			return;
		}

		// A cleared or half-typed field reaches here as nonsense rather than as
		// a date, and a case with no committal on it is worse than a refusal.
		let storageFrom: string;
		let storageTo: string;
		let serviceAt: string;
		let committalAt: string;
		try {
			storageFrom = fromZonedInput(form.storageFromLocal, zone);
			storageTo = fromZonedInput(form.storageToLocal, zone);
			serviceAt = fromZonedInput(form.serviceAtLocal, zone);
			committalAt = fromZonedInput(form.committalAtLocal, zone);
		} catch {
			formError = 'Every date on a case has to be a real date and time.';
			return;
		}

		if (Date.parse(storageTo) <= Date.parse(storageFrom)) {
			formError = 'The bay cannot be given up before the deceased is in it.';
			return;
		}
		if (Date.parse(committalAt) < Date.parse(serviceAt)) {
			formError = 'The committal cannot fall before the service.';
			return;
		}

		const amended = {
			decedentName: form.decedentName.trim(),
			arrangerName: form.arrangerName.trim(),
			payerName: form.payerName.trim() || form.arrangerName.trim(),
			traditionLabel: form.traditionLabel,
			bayName: form.bayName,
			storageFrom,
			storageTo,
			serviceAt,
			committalAt,
			committalSite: form.committalSite,
			awaitingThirdParty: form.awaitingThirdParty,
			provisional: form.provisional
		};

		if (taking) {
			// The reference is derived from the name and the day, so the same
			// case taken twice by two people does not sprout two of them.
			pushBoardEntry({
				reference: newReference(storageFrom, amended.decedentName),
				...amended
			});
			board = loadBoard();
		} else {
			board = updateBoardEntry(form.reference, amended);
		}
		dialog?.close();
	}

	function remove(): void {
		if (!form) return;
		board = removeBoardEntry(form.reference);
		dialog?.close();
	}

	/** The two telephone calls that close a case, straight off the board. */
	function siteConfirmed(entry: BoardEntry): void {
		board = updateBoardEntry(entry.reference, { awaitingThirdParty: false });
	}

	function coronerReleased(entry: BoardEntry): void {
		board = updateBoardEntry(entry.reference, { provisional: false });
	}

	function clearTheBoard(): void {
		resetBoard();
		board = seedBoardOnce(seeded());
	}
</script>

<div class="hairline flex flex-wrap items-end justify-between gap-4 pb-5">
	<div>
		<p class="eyebrow">Today</p>
		<h1 class="display mt-1 text-3xl">{cases.length} in our care</h1>
		<p class="mt-2 text-sm opacity-60">
			{awaiting.length} waiting on a third party · {provisional.length} provisional on a coroner · all
			times {zone}
		</p>
	</div>
	<div class="text-right text-xs opacity-55">
		<p>{data.user.name || data.user.email}</p>
		<p class="opacity-70">{data.user.role}</p>
		<button class="mt-1 link link-hover" onclick={signOut} disabled={signingOut}>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</button>
	</div>
</div>

<dl class="mt-6 grid grid-cols-2 gap-px border border-base-300 bg-base-300 sm:grid-cols-4">
	{#each figures as figure (figure.label)}
		<div class="bg-base-100 p-4">
			<dt class="text-xs opacity-55">{figure.label}</dt>
			<dd class="display mt-1 text-2xl tabular-nums {figure.tone}">{figure.value}</dd>
		</div>
	{/each}
</dl>

<section class="mt-14">
	<h2 class="eyebrow">The next two days</h2>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
		Every step of every case, in the order the building will do them. This is not the board's order
		— a preparation at eight comes before a committal at four, whatever their cases are doing.
	</p>
	{#if agenda.length > 0}
		<ul class="mt-4 space-y-2">
			{#each agenda as item (item.key)}
				<li class="flex flex-wrap items-baseline gap-x-3 border-b border-base-200 pb-2 text-sm">
					<span class="w-40 shrink-0 tabular-nums opacity-70">
						{formatDateInZone(item.startsAt, zone)},
						{formatInZone(item.startsAt, zone)}
					</span>
					<span class="display">{item.label}</span>
					<span class="opacity-60">{item.resourceName}</span>
					<span class="ml-auto flex items-baseline gap-3">
						<span class="opacity-70">{item.entry.decedentName}</span>
						<span class="font-mono text-xs opacity-45">{item.entry.reference}</span>
						{#if item.entry.provisional}
							<span class="badge badge-outline badge-xs badge-warning">Provisional</span>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-4 text-sm opacity-55">Nothing in the next two days.</p>
	{/if}
</section>

<section class="mt-14">
	<h2 class="eyebrow">Cold storage</h2>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
		Three bays. Every day a case sits in one is a day it is not there for the next family, and a bay
		cannot be overbooked, apologised to, or asked to wait in the lobby. This is the resource that
		actually runs out, and it is why a coroner running late is a scheduling problem and not only a
		sad one.
	</p>
	<div class="mt-4 grid gap-4 sm:grid-cols-3">
		{#each bays as bay (bay.name)}
			<div class="rounded-box border border-base-300 p-4">
				<p class="text-xs opacity-55">{bay.name}</p>
				{#if bay.entry}
					{@const occupant = bay.entry}
					{@const held = daysHeld(occupant)}
					{@const level = pressure(occupant)}
					<p class="display mt-1 text-lg">{occupant.decedentName}</p>
					<p class="mt-1 text-xs opacity-55">{occupant.reference}</p>
					<div class="mt-3">
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-base-300">
							<div
								class="h-full {level === 'urgent'
									? 'bg-error'
									: level === 'watch'
										? 'bg-warning'
										: 'bg-primary'}"
								style="width: {Math.min(100, (held / STORAGE_LIMIT_DAYS) * 100)}%"
							></div>
						</div>
						<p class="mt-1.5 text-xs opacity-60">
							Day {held} of {STORAGE_LIMIT_DAYS}
							{#if level === 'urgent'}
								<span class="text-error">· speak to the family</span>
							{/if}
						</p>
					</div>
					{#if bay.clashes > 0}
						<p class="mt-2 text-xs text-error">
							{bay.clashes} other case{bay.clashes === 1 ? '' : 's'} assigned to this bay
						</p>
					{/if}
					<button class="btn mt-3 btn-ghost btn-xs" onclick={() => amend(occupant)}>
						Amend this case
					</button>
				{:else}
					<p class="mt-1 text-lg opacity-35">Empty</p>
					<p class="mt-1 text-xs opacity-45">Available now</p>
				{/if}
			</div>
		{/each}
	</div>
</section>

<section class="mt-14">
	<div class="flex flex-wrap items-baseline justify-between gap-4">
		<h2 class="eyebrow">The board</h2>
		<button class="btn btn-outline btn-xs" onclick={takeACase}>Take a case</button>
	</div>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
		Every case the home is carrying, soonest committal first. Open one to see the whole chain as it
		was booked; amend one when the cemetery telephones back with a different hour, which they will.
		Most cases arrive by telephone rather than through the family flow, so one can be taken here.
	</p>
	<div class="mt-4 overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr class="text-xs">
					<th>Reference</th>
					<th>Deceased</th>
					<th>Arranged by</th>
					<th>Account</th>
					<th>Bay</th>
					<th>Service</th>
					<th>Committal</th>
					<th>State</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each cases as entry (entry.reference)}
					<tr class="hover:bg-base-200/60">
						<td class="font-mono text-xs">
							<button class="link link-hover" onclick={() => toggle(entry.reference)}>
								{opened === entry.reference ? '▾' : '▸'}
								{entry.reference}
							</button>
						</td>
						<td>
							<span class="display">{entry.decedentName}</span>
							<span class="block text-xs opacity-50">{entry.traditionLabel}</span>
						</td>
						<td class="text-sm">{entry.arrangerName}</td>
						<td class="text-sm opacity-70">{entry.payerName}</td>
						<td class="text-sm whitespace-nowrap">
							{entry.bayName.replace('Cold Storage ', '')}
							<span class="block text-xs opacity-50">day {daysHeld(entry)}</span>
						</td>
						<td class="text-sm whitespace-nowrap">
							{formatDateInZone(entry.serviceAt, zone)}
							<span class="block tabular-nums opacity-55">
								{formatInZone(entry.serviceAt, zone)}
							</span>
						</td>
						<td class="text-sm">
							{formatInZone(entry.committalAt, zone)}
							<span class="block text-xs opacity-50">{entry.committalSite}</span>
						</td>
						<td>
							{#if entry.provisional}
								<span class="badge badge-outline badge-sm whitespace-nowrap badge-warning"
									>Provisional</span
								>
							{:else if entry.awaitingThirdParty}
								<span class="badge badge-outline badge-sm whitespace-nowrap">Awaiting site</span>
							{:else}
								<span class="badge badge-outline badge-sm whitespace-nowrap badge-success"
									>Settled</span
								>
							{/if}
						</td>
						<td class="text-right">
							<button class="btn btn-ghost btn-xs" onclick={() => amend(entry)}>Amend</button>
						</td>
					</tr>
					{#if opened === entry.reference}
						<tr class="bg-base-200/40">
							<td colspan="9" class="px-4 py-4">
								<div class="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
									<div>
										<p class="eyebrow">The chain as booked</p>
										{#if entry.steps && entry.steps.length > 0}
											<ol class="mt-3 space-y-2">
												{#each entry.steps as step, index (index)}
													<li class="flex flex-wrap items-baseline gap-x-3 text-sm">
														<span class="w-24 shrink-0 opacity-70">{step.label}</span>
														<span class="tabular-nums">
															{formatDateInZone(step.startsAt, zone)},
															{formatInZone(step.startsAt, zone)}–{formatInZone(step.endsAt, zone)}
														</span>
														<span class="opacity-60">{step.resourceName}</span>
														{#if step.bookingId}
															<span class="ml-auto font-mono text-xs opacity-40">
																{step.bookingId.slice(0, 8)}
															</span>
														{/if}
													</li>
												{/each}
											</ol>
										{:else}
											<p class="mt-3 max-w-xl text-sm leading-relaxed opacity-60">
												This case was entered before the board kept the whole chain. Its service and
												its committal are on the row above; the rest is in the day book.
											</p>
										{/if}
									</div>
									<div class="text-sm">
										<p class="eyebrow">In our care</p>
										<p class="mt-3 opacity-70">
											{formatDateInZone(entry.storageFrom, zone)}
											<span class="block opacity-60">
												until {formatDateInZone(entry.storageTo, zone)}
											</span>
										</p>
										<div class="mt-4 flex flex-wrap gap-2">
											{#if entry.awaitingThirdParty}
												<button class="btn btn-outline btn-xs" onclick={() => siteConfirmed(entry)}>
													Site confirmed
												</button>
											{/if}
											{#if entry.provisional}
												<button
													class="btn btn-outline btn-xs"
													onclick={() => coronerReleased(entry)}
												>
													Coroner released
												</button>
											{/if}
										</div>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
	{#if cases.length === 0}
		<p class="mt-4 text-sm opacity-55">Nothing on the board.</p>
	{/if}
</section>

{#if awaiting.length > 0}
	<section class="mt-14">
		<h2 class="eyebrow">Not ours to confirm</h2>
		<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
			Cemeteries and crematoria keep their own diaries and have no intention of sharing them. We can
			hold the chapel, the celebrant, the hearse and the bearers, and still not have the hole. These
			are confirmed by telephone, by a man called Piotr, between nine and eleven.
		</p>
		<ul class="mt-4 space-y-2">
			{#each awaiting as entry (entry.reference)}
				<li class="flex flex-wrap items-baseline gap-x-3 border-b border-base-200 pb-2 text-sm">
					<span class="font-mono text-xs opacity-55">{entry.reference}</span>
					<span class="display">{entry.decedentName}</span>
					<span class="opacity-60">{entry.committalSite}</span>
					<span class="ml-auto tabular-nums opacity-55">
						{formatDateInZone(entry.committalAt, zone)}, {formatInZone(entry.committalAt, zone)}
					</span>
					<button class="btn btn-outline btn-xs" onclick={() => siteConfirmed(entry)}>
						Confirmed
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if provisional.length > 0}
	<section class="mt-14">
		<h2 class="eyebrow">Provisional on a coroner</h2>
		<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
			Nothing here may be promised to a family as a date. The body is the coroner's until they
			release it, and every hour they take drags five bookings and a refrigerated bay behind it.
		</p>
		<ul class="mt-4 space-y-2">
			{#each provisional as entry (entry.reference)}
				<li class="flex flex-wrap items-baseline gap-x-3 border-b border-base-200 pb-2 text-sm">
					<span class="font-mono text-xs opacity-55">{entry.reference}</span>
					<span class="display">{entry.decedentName}</span>
					<span class="opacity-60">service {formatDateInZone(entry.serviceAt, zone)}</span>
					<button class="btn ml-auto btn-outline btn-xs" onclick={() => coronerReleased(entry)}>
						Released
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="mt-14">
	<h2 class="eyebrow">What we publish</h2>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
		The steps a family's plan is assembled from, exactly as the booking API advertises them. A
		director asked why a plan chose the reserve hearse can see here what the choice was.
	</p>
	<div class="mt-4 overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr class="text-xs">
					<th>Step</th>
					<th>What it is</th>
					<th class="text-right">Duration</th>
					<th>Runs on</th>
				</tr>
			</thead>
			<tbody>
				{#each data.services as service (service.id)}
					<tr>
						<td class="display whitespace-nowrap">{service.name}</td>
						<td class="max-w-md text-sm opacity-65">{service.description ?? '—'}</td>
						<td class="text-right text-sm whitespace-nowrap tabular-nums">
							{service.durationMinutes} min
						</td>
						<td class="text-sm">
							{#if service.resources.length > 0}
								{service.resources.map((resource) => resource.name).join(', ')}
							{:else}
								<span class="opacity-50">Assigned by us</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section class="mt-14">
	<h2 class="eyebrow">What we have</h2>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed opacity-65">
		The rooms, the cars and the sites behind those steps. Two of these groups are not ordinary
		inventory: cold storage is held for days rather than for an hour, and a committal site belongs
		to somebody else entirely.
	</p>
	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		{#each inventoryGroups as group (group.id)}
			<div class="rounded-box border border-base-300 p-4">
				<div class="flex items-baseline justify-between gap-3">
					<p class="display text-lg">{group.label}</p>
					<p class="text-xs tabular-nums opacity-50">{group.rows.length}</p>
				</div>
				{#if group.note}
					<p class="mt-1 text-xs leading-relaxed opacity-55">{group.note}</p>
				{/if}
				<ul class="mt-3 space-y-1.5">
					{#each group.rows as row (row.name)}
						<li class="border-b border-base-200 pb-1.5 text-sm last:border-0">
							{row.name}
							<span class="block text-xs opacity-50">
								{row.steps.length > 0 ? row.steps.join(' · ') : 'Not published'}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>

<div class="mt-14 flex flex-wrap items-center gap-4">
	<a href={resolve(`/${data.organization.slug}`)} class="btn btn-ghost btn-sm">
		Begin an arrangement
	</a>
	<button class="btn btn-ghost opacity-60 btn-sm" onclick={clearTheBoard}>
		Clear the board and lay out the demonstration cases again
	</button>
	<p class="w-full text-xs opacity-40">
		Not linked from anywhere a family can reach, and not theirs to see.
	</p>
</div>

<dialog class="modal" bind:this={dialog} onclose={() => (form = undefined)}>
	<div class="modal-box max-w-2xl border border-base-300">
		{#if form}
			<form onsubmit={save}>
				<p class="eyebrow">{taking ? 'Taking a case' : 'Amending'}</p>
				<h3 class="display mt-1 text-2xl">
					{form.decedentName || (taking ? 'A case by telephone' : 'This case')}
				</h3>
				<p class="mt-1 font-mono text-xs opacity-55">
					{form.reference || 'A reference is given when this is saved'}
				</p>

				<div class="mt-6 grid gap-4 sm:grid-cols-2">
					<label class="form-control sm:col-span-2">
						<span class="label-text py-1 text-sm">The deceased</span>
						<input
							class="input-bordered input w-full"
							maxlength="255"
							bind:value={form.decedentName}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Arranged by</span>
						<input
							class="input-bordered input w-full"
							maxlength="255"
							bind:value={form.arrangerName}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Account settled by</span>
						<input
							class="input-bordered input w-full"
							maxlength="255"
							bind:value={form.payerName}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Tradition</span>
						<select class="select-bordered select w-full" bind:value={form.traditionLabel}>
							{#each TRADITIONS as tradition (tradition.id)}
								<option value={tradition.label}>{tradition.label}</option>
							{/each}
						</select>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Bay</span>
						<select class="select-bordered select w-full" bind:value={form.bayName}>
							{#each STORAGE_BAYS as bay (bay.id)}
								<option value={bay.name}>{bay.name}</option>
							{/each}
						</select>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">In our care from</span>
						<input
							class="input-bordered input w-full"
							type="datetime-local"
							bind:value={form.storageFromLocal}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Until</span>
						<input
							class="input-bordered input w-full"
							type="datetime-local"
							bind:value={form.storageToLocal}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Service</span>
						<input
							class="input-bordered input w-full"
							type="datetime-local"
							bind:value={form.serviceAtLocal}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Committal</span>
						<input
							class="input-bordered input w-full"
							type="datetime-local"
							bind:value={form.committalAtLocal}
						/>
					</label>
					<label class="form-control sm:col-span-2">
						<span class="label-text py-1 text-sm">Committal site</span>
						<select class="select-bordered select w-full" bind:value={form.committalSite}>
							{#each sites as site (site)}
								<option value={site}>{site}</option>
							{/each}
							{#if !sites.includes(form.committalSite)}
								<option value={form.committalSite}>{form.committalSite}</option>
							{/if}
						</select>
					</label>
				</div>

				<p class="mt-4 text-xs opacity-55">Times are {zone}, the home's own clock.</p>

				<div class="mt-4 space-y-2">
					<label class="flex items-center gap-3 text-sm">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:checked={form.awaitingThirdParty}
						/>
						Waiting on the site to confirm their slot
					</label>
					<label class="flex items-center gap-3 text-sm">
						<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.provisional} />
						Provisional — the coroner has not released
					</label>
				</div>

				{#if formError}
					<div role="alert" class="mt-4 alert alert-error"><span>{formError}</span></div>
				{/if}

				<div class="modal-action items-center">
					{#if confirmingRemoval}
						<span class="mr-auto text-sm">Take this case off the board?</span>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => (confirmingRemoval = false)}
						>
							Keep it
						</button>
						<button type="button" class="btn btn-error btn-sm" onclick={remove}>Remove</button>
					{:else}
						{#if !taking}
							<button
								type="button"
								class="btn mr-auto btn-ghost text-error btn-sm"
								onclick={() => (confirmingRemoval = true)}
							>
								Remove
							</button>
						{/if}
						<button
							type="button"
							class="btn btn-ghost btn-sm {taking ? 'ml-auto' : ''}"
							onclick={() => dialog?.close()}
						>
							Cancel
						</button>
						<button type="submit" class="btn btn-primary btn-sm">
							{taking ? 'Take the case' : 'Save the amendment'}
						</button>
					{/if}
				</div>
			</form>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>Close</button>
	</form>
</dialog>
