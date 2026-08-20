<script lang="ts">
	import PlanTimeline from './PlanTimeline.svelte';
	import type { Plan } from '$lib/funeral/chain';
	import { formatDateInZone, formatInZone } from '$lib/time';

	let {
		plan,
		zone,
		selected,
		onselect
	}: {
		plan: Plan;
		zone: string;
		selected: boolean;
		onselect: (plan: Plan) => void;
	} = $props();
</script>

<article
	class="settle rounded-box border bg-base-100 transition-colors
		{selected ? 'border-primary/60 ring-1 ring-primary/25' : 'border-base-300'}"
>
	<div class="p-5">
		<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
			<h3 class="display text-xl">{plan.title}</h3>
			<p class="text-sm opacity-70">
				Service {formatDateInZone(plan.serviceAt, zone)}, {formatInZone(plan.serviceAt, zone)}
			</p>
		</div>
		<p class="mt-1 text-sm opacity-60">{plan.rationale}</p>

		<div class="mt-4">
			<PlanTimeline {plan} {zone} />
		</div>

		<ol class="mt-5 grid gap-2 sm:grid-cols-2">
			{#each plan.steps as step (step.role)}
				<li class="flex gap-3 text-sm">
					<span class="w-24 shrink-0 tabular-nums opacity-55">
						{formatInZone(step.startsAt, zone)}
					</span>
					<span class="min-w-0">
						<span class="font-medium">{step.label}</span>
						<span class="block text-xs opacity-55">{step.resourceName}</span>
					</span>
				</li>
			{/each}
		</ol>

		{#if plan.warnings.length > 0}
			<ul class="mt-4 space-y-1 border-t border-base-300 pt-3">
				{#each plan.warnings as warning (warning)}
					<li class="text-xs leading-relaxed opacity-60">— {warning}</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-5 flex items-center justify-between gap-4">
			<p class="text-xs opacity-50">
				{plan.storage.resourceName} held {plan.storage.days}
				day{plan.storage.days === 1 ? '' : 's'}
			</p>
			<button
				type="button"
				class="btn btn-sm {selected ? 'btn-primary' : 'btn-outline'}"
				onclick={() => onselect(plan)}
			>
				{selected ? 'Chosen' : 'Choose this'}
			</button>
		</div>
	</div>
</article>
