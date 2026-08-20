<script lang="ts">
	import type { Plan } from '$lib/funeral/chain';
	import { formatDateInZone, formatInZone } from '$lib/time';

	let { plan, zone, compact = false }: { plan: Plan; zone: string; compact?: boolean } = $props();

	/**
	 * One row per resource the plan touches, cold storage first. The rows are
	 * built from the plan rather than from the resource list so a plan only
	 * ever draws the chapel it actually uses — an empty row for the chapel it
	 * did not choose reads as a gap in the day, which it is not.
	 */
	interface Row {
		key: string;
		label: string;
		bars: Array<{
			key: string;
			label: string;
			startsAt: string;
			endsAt: string;
			held: boolean;
			thirdParty: boolean;
		}>;
		/** Shown on the storage row: what the clipped bar does not say itself. */
		aside?: string;
	}

	/**
	 * The scale spans the *chain*, not the storage hold.
	 *
	 * Holding a bay for three days while the service itself takes an hour is
	 * exactly the point of this product, and it is also what makes the obvious
	 * scale useless: fit the hold on screen and every step collapses into a
	 * two-pixel sliver. So the axis covers the steps, and the storage bar is
	 * clamped to the edges with an arrow where it runs off — the row still reads
	 * as one unbroken hold, and the chain stays legible.
	 */
	const scale = $derived.by(() => {
		const starts = plan.steps.map((step) => Date.parse(step.startsAt));
		const ends = plan.steps.map((step) => Date.parse(step.endsAt));
		const first = Math.min(...starts);
		const last = Math.max(...ends);
		const pad = Math.max((last - first) * 0.04, 900_000);
		const from = first - pad;
		const to = last + pad;
		const span = Math.max(to - from, 60_000);
		const at = (instant: string) => ((Date.parse(instant) - from) / span) * 100;
		return {
			from,
			to,
			span,
			percent: (instant: string) => Math.max(0, Math.min(100, at(instant))),
			/** Clamped width, so a bar running past either edge stops at it. */
			width: (startsAt: string, endsAt: string) => {
				const left = Math.max(0, Math.min(100, at(startsAt)));
				const right = Math.max(0, Math.min(100, at(endsAt)));
				return Math.max(right - left, 0);
			},
			before: (instant: string) => Date.parse(instant) < from,
			after: (instant: string) => Date.parse(instant) > to
		};
	});

	const rows = $derived.by((): Row[] => {
		const storageRow: Row = {
			key: plan.storage.resourceId,
			label: plan.storage.resourceName,
			aside: `from ${formatDateInZone(plan.storage.startsAt, zone)}`,
			bars: [
				{
					key: 'storage',
					label: `Held ${plan.storage.days} day${plan.storage.days === 1 ? '' : 's'}`,
					startsAt: plan.storage.startsAt,
					endsAt: plan.storage.endsAt,
					held: true,
					thirdParty: false
				}
			]
		};

		// Grouped into an array rather than a Map so the row order stays the order
		// the steps happen in, which is the order a reader expects to scan.
		const byResource: Row[] = [];
		for (const step of plan.steps) {
			const bar = {
				key: `${step.role}-${step.startsAt}`,
				label: step.label,
				startsAt: step.startsAt,
				endsAt: step.endsAt,
				held: false,
				thirdParty: step.thirdParty
			};
			const existing = byResource.find((row) => row.key === step.resourceId);
			if (existing) {
				existing.bars.push(bar);
			} else {
				byResource.push({ key: step.resourceId, label: step.resourceName, bars: [bar] });
			}
		}

		return [storageRow, ...byResource];
	});

	/**
	 * Day boundaries, so a chain that crosses midnight reads as two days
	 * rather than one long afternoon. Computed in the org's zone, not the
	 * viewer's — the family may be reading this from another country.
	 */
	const dayMarks = $derived.by(() => {
		const marks: Array<{ at: number; label: string }> = [];
		const dayFormat = new Intl.DateTimeFormat('en-GB', {
			timeZone: zone,
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
		// Step an hour at a time and mark where the local date changes. The span
		// is days, not years, so this stays cheap.
		let previous = dayFormat.format(new Date(scale.from));
		for (let at = scale.from; at <= scale.to; at += 1_800_000) {
			const label = dayFormat.format(new Date(at));
			if (label !== previous) {
				marks.push({ at, label });
				previous = label;
			}
		}
		return marks;
	});
</script>

<div class="w-full">
	{#if !compact}
		<div class="mb-2 flex justify-between text-xs opacity-55">
			<span>{formatDateInZone(plan.startsAt, zone)}, {formatInZone(plan.startsAt, zone)}</span>
			<span>{formatDateInZone(plan.endsAt, zone)}, {formatInZone(plan.endsAt, zone)}</span>
		</div>
	{/if}

	<div class="relative rounded-box bg-base-200/60 p-3">
		<!-- Midnight rules, drawn under the bars. -->
		{#each dayMarks as mark (mark.at)}
			{@const x = ((mark.at - scale.from) / scale.span) * 100}
			<div
				class="pointer-events-none absolute inset-y-0 border-l border-dashed border-base-content/15"
				style="left: calc({x}% + 0.75rem);"
			>
				{#if !compact}
					<span class="absolute top-1 left-1 text-[0.6rem] whitespace-nowrap opacity-45">
						{mark.label}
					</span>
				{/if}
			</div>
		{/each}

		<div class="relative flex flex-col gap-1.5">
			{#each rows as row (row.key)}
				<div class="grid grid-cols-[9.5rem_1fr] items-center gap-3">
					<span class="truncate text-right text-xs opacity-65" title={row.label}>
						{row.label}
						{#if row.aside}
							<span class="block text-[0.6rem] opacity-70">{row.aside}</span>
						{/if}
					</span>
					<div class="relative h-7">
						<div class="absolute inset-y-0 w-full rounded-sm bg-base-100/70"></div>
						{#each row.bars as bar (bar.key)}
							<div
								class="absolute inset-y-0 flex items-center overflow-hidden px-2
									{scale.before(bar.startsAt) ? 'rounded-r-sm' : 'rounded-sm'}
									{bar.held
									? 'bg-secondary/25 ring-1 ring-secondary/40'
									: bar.thirdParty
										? 'bg-warning/30 ring-1 ring-warning/50'
										: 'bg-primary/85 text-primary-content'}"
								style="left: {scale.percent(bar.startsAt)}%; width: {Math.max(
									scale.width(bar.startsAt, bar.endsAt),
									1.5
								)}%;"
								title="{bar.label} · {formatDateInZone(bar.startsAt, zone)} {formatInZone(
									bar.startsAt,
									zone
								)}–{formatInZone(bar.endsAt, zone)}"
							>
								{#if scale.before(bar.startsAt)}
									<span class="mr-1 text-[0.7rem] leading-none opacity-60" aria-hidden="true"
										>‹</span
									>
								{/if}
								<span class="truncate text-[0.68rem] leading-none whitespace-nowrap">
									{bar.label}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if !compact}
		<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.68rem] opacity-60">
			<span class="flex items-center gap-1.5">
				<span class="h-2.5 w-4 rounded-xs bg-secondary/40"></span> held continuously
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-2.5 w-4 rounded-xs bg-primary/85"></span> ours to schedule
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-2.5 w-4 rounded-xs bg-warning/50"></span> third party, awaiting their confirmation
			</span>
		</div>
	{/if}
</div>
