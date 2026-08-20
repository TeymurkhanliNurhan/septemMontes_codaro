<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PlanTimeline from '$lib/components/funeral/PlanTimeline.svelte';
	import type { Plan } from '$lib/funeral/chain';
	import { formatDateInZone, formatInZone } from '$lib/time';

	// Same reasoning as the old confirmation page: there is no public GET for a
	// booking, because that would let anyone enumerate a home's cases. The plan
	// arrives through navigation state, so a refresh loses it by design.
	const plan = $derived(page.state.plan as Plan | undefined);
	const zone = $derived((page.state.zone as string | undefined) ?? 'UTC');
	const reference = $derived(page.state.reference as string | undefined);
	const slug = $derived(page.params.slug ?? 'septem');
</script>

<div class="mx-auto max-w-3xl">
	{#if plan}
		<p class="eyebrow settle">Held</p>
		<h1 class="display settle mt-2 text-3xl">
			{formatDateInZone(plan.serviceAt, zone)} is held for {formatInZone(plan.serviceAt, zone)}.
		</h1>
		<p class="settle mt-3 max-w-xl leading-relaxed opacity-70">
			Nothing more is asked of you today. A director will telephone before the end of the day to go
			through it, and to tell you what the cemetery says about their slot.
		</p>

		<p class="mt-6 text-sm">
			<span class="opacity-55">Reference</span>
			<span class="ml-2 font-mono">{reference}</span>
		</p>

		<div class="hairline mt-10 pb-3">
			<h2 class="display text-xl">The whole of it</h2>
		</div>
		<div class="mt-5">
			<PlanTimeline {plan} {zone} />
		</div>

		<ol class="mt-8 space-y-4">
			{#each plan.steps as step (step.role)}
				<li class="flex gap-5 border-b border-base-200 pb-4">
					<span class="w-40 shrink-0 text-sm opacity-60">
						{formatDateInZone(step.startsAt, zone)}
						<span class="block tabular-nums">
							{formatInZone(step.startsAt, zone)}–{formatInZone(step.endsAt, zone)}
						</span>
					</span>
					<span class="min-w-0">
						<span class="display text-lg">{step.label}</span>
						<span class="block text-sm opacity-60">{step.blurb}</span>
						<span class="mt-1 block text-xs opacity-50">
							{step.resourceName}{#if step.thirdParty}
								· awaiting their confirmation{/if}
						</span>
					</span>
				</li>
			{/each}
		</ol>

		<p class="mt-8 text-sm leading-relaxed opacity-60">
			{plan.storage.resourceName} is held for {plan.storage.days}
			day{plan.storage.days === 1 ? '' : 's'}, from the moment we collect until the committal.
		</p>

		<div class="mt-10 flex gap-4">
			<a href={resolve(`/${slug}/director`)} class="btn btn-ghost btn-sm">Director's console</a>
		</div>
	{:else}
		<p class="eyebrow settle">Held</p>
		<h1 class="display settle mt-2 text-3xl">The arrangement went through.</h1>
		<p class="settle mt-3 max-w-xl leading-relaxed opacity-70">
			The details were only on the page you were sent to, and refreshing loses them — we do not
			leave a family's arrangement sitting at a web address anyone could find. Your reference was
			sent by email, and a director will call.
		</p>
		<a href={resolve('/')} class="btn mt-8 btn-primary">Back to the beginning</a>
	{/if}
</div>
