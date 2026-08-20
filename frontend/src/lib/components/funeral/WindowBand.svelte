<script lang="ts">
	import { describeSpan, type FeasibleWindow } from '$lib/funeral/constraints';
	import { formatDateInZone, formatInZone } from '$lib/time';

	let { window: feasible, zone }: { window: FeasibleWindow; zone: string } = $props();

	/**
	 * The band is drawn over a span wider than the window itself, so the
	 * constraints that lost still have somewhere to sit. A tenth of the window
	 * either side is enough to separate the pins without shrinking the shaded
	 * region into a sliver.
	 */
	const geometry = $derived.by(() => {
		const earliest = Date.parse(feasible.earliest);
		const latest = Date.parse(feasible.latest);
		const marks = feasible.constraints.map((constraint) => Date.parse(constraint.at));
		const low = Math.min(earliest, latest, ...marks);
		const high = Math.max(earliest, latest, ...marks);
		const pad = Math.max((high - low) * 0.08, 3_600_000);
		const from = low - pad;
		const to = high + pad;
		const span = to - from;
		return {
			from,
			span,
			percent: (instant: number) => ((instant - from) / span) * 100
		};
	});

	const left = $derived(geometry.percent(Date.parse(feasible.earliest)));
	const right = $derived(geometry.percent(Date.parse(feasible.latest)));

	/**
	 * Lower and upper bounds are drawn on separate rails. Interleaving them on
	 * one line put a coroner release on top of a religious deadline whenever
	 * the window was tight, which is exactly when it matters most.
	 */
	const lower = $derived(
		feasible.constraints.filter((constraint) => constraint.kind === 'EARLIEST')
	);
	const upper = $derived(feasible.constraints.filter((constraint) => constraint.kind === 'LATEST'));
</script>

<div class="settle">
	<div class="hairline mb-5 pb-3">
		<p class="eyebrow">The window</p>
		<h2 class="display mt-1 text-2xl">
			{#if feasible.impossible}
				These constraints cannot all be met
			{:else}
				{formatDateInZone(feasible.earliest, zone)}, {formatInZone(feasible.earliest, zone)}
				&nbsp;—&nbsp;
				{formatDateInZone(feasible.latest, zone)}, {formatInZone(feasible.latest, zone)}
			{/if}
		</h2>
		<p class="mt-1 text-sm opacity-60">
			{#if feasible.impossible}
				The deadline falls before the earliest moment anything can begin. A director will call you.
			{:else}
				{describeSpan(feasible.earliest, feasible.latest)} wide · all times {zone}
			{/if}
		</p>
	</div>

	<!-- The band. Pins above are lower bounds, pins below are deadlines. -->
	<div class="px-2 py-1">
		<div class="relative h-24">
			{#each lower as constraint (constraint.id)}
				{@const x = geometry.percent(Date.parse(constraint.at))}
				<div
					class="absolute top-0 flex h-full flex-col justify-end"
					style="left: {x}%; transform: translateX(-1px);"
				>
					<span
						class="w-px flex-1 {constraint.binding
							? 'bg-secondary'
							: 'bg-base-content/20'} {constraint.hard ? '' : 'opacity-50'}"
					></span>
				</div>
			{/each}
			{#each upper as constraint (constraint.id)}
				{@const x = geometry.percent(Date.parse(constraint.at))}
				<div class="absolute top-0 h-full" style="left: {x}%; transform: translateX(-1px);">
					<span class="block h-full w-px {constraint.binding ? 'bg-error' : 'bg-base-content/20'}"
					></span>
				</div>
			{/each}

			<!-- The feasible region itself. -->
			<div
				class="absolute top-1/2 h-9 -translate-y-1/2 bg-accent/45 ring-1 ring-base-content/40"
				style="left: {left}%; width: {Math.max(0, right - left)}%;"
			></div>
			<div class="absolute top-1/2 h-px w-full -translate-y-1/2 bg-base-content/15"></div>
		</div>
	</div>

	<!-- Every constraint in words. The band shows where; this says why. -->
	<ul class="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
		{#each feasible.constraints as constraint (constraint.id)}
			<li class="flex gap-3">
				<span
					class="mt-1.5 h-2 w-2 shrink-0 rounded-full {constraint.binding
						? constraint.kind === 'LATEST'
							? 'bg-error'
							: 'bg-secondary'
						: 'bg-base-content/25'}"
					aria-hidden="true"
				></span>
				<div class="min-w-0">
					<p class="text-sm">
						<span class={constraint.binding ? 'font-semibold' : ''}>{constraint.label}</span>
						<span class="opacity-50">·</span>
						<span class="opacity-70">
							{formatDateInZone(constraint.at, zone)}, {formatInZone(constraint.at, zone)}
						</span>
						{#if !constraint.hard}
							<span class="ml-1 align-middle text-[0.65rem] uppercase opacity-45">wish</span>
						{/if}
					</p>
					<p class="mt-0.5 text-xs leading-relaxed opacity-55">{constraint.detail}</p>
				</div>
			</li>
		{/each}
	</ul>
</div>
