<script lang="ts">
	import { resolve } from '$app/paths';
	import { loadBoard, type BoardEntry } from '$lib/funeral/case-store';
	import { STORAGE_LIMIT_DAYS } from '$lib/funeral/constraints';
	import { formatDateInZone, formatInZone } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const zone = $derived(data.organization.timezone);

	/**
	 * Cases the home is carrying today. Seeded ones stand for the work already
	 * in the building; anything the family flow confirmed is appended to them,
	 * so a demonstration shows a board under load rather than an empty one.
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
				provisional: false
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
				provisional: false
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
				provisional: true
			}
		];
	}

	let board = $state<BoardEntry[]>([]);

	$effect(() => {
		const confirmed = loadBoard();
		// The family flow may have re-used a seeded bay; the board shows what was
		// entered, and a clash is a thing for the director to see, not to hide.
		const merged = [...seeded(), ...confirmed];
		board = merged.sort((a, b) => Date.parse(a.committalAt) - Date.parse(b.committalAt));
	});

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

	const bays = $derived.by(() =>
		['Cold Storage Bay 1', 'Cold Storage Bay 2', 'Cold Storage Bay 3'].map((name) => ({
			name,
			// The earliest committal in that bay is the case the director is
			// working on now; `board` is already sorted that way.
			entry: board.find((candidate) => candidate.bayName === name)
		}))
	);

	const awaiting = $derived(board.filter((entry) => entry.awaitingThirdParty));
	const provisional = $derived(board.filter((entry) => entry.provisional));
</script>

<div class="hairline pb-5">
	<p class="eyebrow">Today</p>
	<h1 class="display mt-1 text-3xl">{board.length} in our care</h1>
	<p class="mt-2 text-sm opacity-60">
		{awaiting.length} waiting on a third party · {provisional.length} provisional on a coroner · all times
		{zone}
	</p>
</div>

<section class="mt-10">
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
					{@const held = daysHeld(bay.entry)}
					{@const level = pressure(bay.entry)}
					<p class="display mt-1 text-lg">{bay.entry.decedentName}</p>
					<p class="mt-1 text-xs opacity-55">{bay.entry.reference}</p>
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
				{:else}
					<p class="mt-1 text-lg opacity-35">Empty</p>
					<p class="mt-1 text-xs opacity-45">Available now</p>
				{/if}
			</div>
		{/each}
	</div>
</section>

<section class="mt-14">
	<h2 class="eyebrow">The board</h2>
	<div class="mt-4 overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr class="text-xs">
					<th>Reference</th>
					<th>Deceased</th>
					<th>Arranged by</th>
					<th>Account</th>
					<th>Service</th>
					<th>Committal</th>
					<th>State</th>
				</tr>
			</thead>
			<tbody>
				{#each board as entry (entry.reference)}
					<tr class="hover:bg-base-200/60">
						<td class="font-mono text-xs">{entry.reference}</td>
						<td>
							<span class="display">{entry.decedentName}</span>
							<span class="block text-xs opacity-50">{entry.traditionLabel}</span>
						</td>
						<td class="text-sm">{entry.arrangerName}</td>
						<td class="text-sm opacity-70">{entry.payerName}</td>
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
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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
				</li>
			{/each}
		</ul>
	</section>
{/if}

<div class="mt-14">
	<a href={resolve(`/${data.organization.slug}`)} class="btn btn-ghost btn-sm">
		Begin an arrangement
	</a>
</div>
