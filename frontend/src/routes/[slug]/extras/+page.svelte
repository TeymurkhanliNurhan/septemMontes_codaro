<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Plan } from '$lib/funeral/chain';
	import { formatDateInZone } from '$lib/time';
	import type { PageData } from './$types';

	/**
	 * The upsell.
	 *
	 * Everything the rest of this product refuses to do, done at once: urgency,
	 * a held-price countdown, scarcity on the doves, one option pre-selected on
	 * the family's behalf, a bundle, and a decline link that invokes the dead
	 * woman by name. The footer of every other page promises no countdown
	 * timers. There is a countdown timer on this page.
	 *
	 * It is satire with a real target. Selling a grieving family an upgrade they
	 * cannot evaluate, at the one moment in their life when they will agree to
	 * anything rather than seem cheap about their mother, is a documented
	 * practice of the funeral trade and not an invention of ours. The joke is at
	 * the industry's expense, never at the family's and never at the deceased's
	 * — so the products are real products, the prices are plausible, and not one
	 * line here mocks anybody for buying.
	 */
	let { data }: { data: PageData } = $props();

	const plan = $derived(page.state.plan as Plan | undefined);
	const zone = $derived((page.state.zone as string | undefined) ?? 'UTC');
	const reference = $derived(page.state.reference as string | undefined);
	const decedent = $derived((page.state.decedentName as string | undefined) ?? 'they');

	/** First name only, because that is how the guilt trip is written. */
	const firstName = $derived(decedent.split(/\s+/)[0] ?? 'They');

	interface Extra {
		id: string;
		name: string;
		price: number;
		/** Rendered under the price when the charge recurs. */
		per?: string;
		blurb: string;
		badge?: string;
		/** Chosen on the family's behalf, which is the entire point of it. */
		preselected?: boolean;
	}

	const BASE = 4200;

	const EXTRAS: Extra[] = [
		{
			id: 'oak',
			name: 'Solid oak, rather than veneer',
			price: 1850,
			blurb:
				'It will be underground within the hour either way. A number of families still prefer to know.',
			badge: 'Selected for you',
			preselected: true
		},
		{
			id: 'doves',
			name: 'Six doves, released at the graveside',
			price: 420,
			blurb:
				'They are trained to fly straight home, which everybody finds moving and nobody examines too closely.',
			badge: 'Only 1 set left today'
		},
		{
			id: 'booklets',
			name: 'Order of service, eighty copies',
			price: 260,
			blurb:
				'Heavy stock, photograph on the cover. You will come across a box of these in a cupboard in nine years.'
		},
		{
			id: 'stream',
			name: 'The service, streamed',
			price: 300,
			blurb: 'For the brother in Chicago.',
			badge: 'Most families add this'
		},
		{
			id: 'soloist',
			name: 'A soloist',
			price: 600,
			blurb: 'A soprano. She is very good, and she is aware that she is very good.'
		},
		{
			id: 'limousine',
			name: 'A second limousine',
			price: 750,
			blurb: 'Seats six. The first one seats four, and there are always seven of you.'
		},
		{
			id: 'care',
			name: 'Perpetual grave care',
			price: 45,
			per: 'a month',
			blurb:
				'A subscription, and we hear ourselves saying it. Renews annually and lapses on its own after ninety years.',
			badge: 'Subscription'
		}
	];

	const BUNDLE_IDS = ['oak', 'doves', 'booklets', 'soloist'];
	const BUNDLE_PRICE = 2690;

	let chosen = $state<string[]>(EXTRAS.filter((extra) => extra.preselected).map((e) => e.id));

	function toggle(id: string): void {
		chosen = chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id];
	}

	function takeBundle(): void {
		chosen = [...new Set([...chosen, ...BUNDLE_IDS])];
	}

	const bundleTaken = $derived(BUNDLE_IDS.every((id) => chosen.includes(id)));

	const bundleFull = $derived(
		EXTRAS.filter((extra) => BUNDLE_IDS.includes(extra.id)).reduce(
			(sum, extra) => sum + extra.price,
			0
		)
	);

	/**
	 * One-off charges only. The subscription is deliberately left out of the
	 * total and shown separately, exactly as it would be.
	 */
	const total = $derived(
		EXTRAS.filter((extra) => chosen.includes(extra.id) && !extra.per).reduce(
			(sum, extra) => sum + extra.price,
			BASE
			// The bundle discount comes off once all four of its parts are in the
			// basket, however they got there — ticking them one at a time earns the
			// same saving as pressing the button, which is the one respectable
			// thing on this page.
		) - (bundleTaken ? bundleFull - BUNDLE_PRICE : 0)
	);

	const monthly = $derived(
		EXTRAS.filter((extra) => chosen.includes(extra.id) && extra.per).reduce(
			(sum, extra) => sum + extra.price,
			0
		)
	);

	const money = new Intl.NumberFormat('pl-PL', {
		style: 'currency',
		currency: 'PLN',
		maximumFractionDigits: 0
	});

	// The held-price countdown, which is the joke the footer has been setting up
	// on every other page. It counts down and then it does absolutely nothing,
	// because that is also true of every one of these that you have ever seen.
	let secondsLeft = $state(9 * 60 + 58);

	$effect(() => {
		const handle = setInterval(() => {
			secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 0;
		}, 1000);
		return () => clearInterval(handle);
	});

	const clock = $derived(
		`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
	);

	function onward(): void {
		const added = EXTRAS.filter((extra) => chosen.includes(extra.id)).map((extra) => extra.name);
		void goto(resolve(`/${data.organization.slug}/confirmed`), {
			state: { ...page.state, extras: added, total, monthly }
		});
	}

	function decline(): void {
		void goto(resolve(`/${data.organization.slug}/confirmed`), {
			state: { ...page.state, extras: [], total: BASE, monthly: 0 }
		});
	}
</script>

{#if plan}
	<div class="max-w-3xl">
		<p class="eyebrow settle">While we have you</p>
		<h1 class="display settle mt-2 text-3xl sm:text-4xl">Would you like anything with that?</h1>
		<p class="settle mt-3 leading-relaxed opacity-75">
			{reference} is held — the chapel, the car, the plot, all of it. Nothing below is necessary and nothing
			below will be missed. We have not mentioned money once until now. This is the page where we mention
			money.
		</p>

		<!-- The contradiction of the footer, stated as loudly as possible. -->
		<div
			class="settle mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-2 border-base-content px-4 py-2"
		>
			<span class="eyebrow">This pricing is held for</span>
			<span class="display text-2xl tabular-nums">{clock}</span>
			<span class="text-xs opacity-50">
				After that these prices become, in all likelihood, exactly the same prices.
			</span>
		</div>

		<!-- The meal deal. -->
		<div class="settle mt-10 border-2 border-base-content p-5">
			<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<div>
					<p class="eyebrow">Chosen together most often</p>
					<h2 class="display mt-1 text-2xl">The Dignity Bundle</h2>
				</div>
				<p class="text-right">
					<span class="display text-2xl">{money.format(BUNDLE_PRICE)}</span>
					<span class="ml-2 text-sm line-through opacity-40">{money.format(bundleFull)}</span>
				</p>
			</div>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				The oak, the doves, the booklets and the soprano. Saves you
				{money.format(bundleFull - BUNDLE_PRICE)}, which is not nothing.
			</p>
			<button
				class="btn mt-4 btn-sm {bundleTaken ? 'btn-disabled' : 'btn-primary'}"
				onclick={takeBundle}
			>
				{bundleTaken ? 'Added' : 'Add the bundle'}
			</button>
		</div>

		<ul class="mt-10 divide-y divide-base-300 border-y border-base-300">
			{#each EXTRAS as extra (extra.id)}
				{@const on = chosen.includes(extra.id)}
				<li class="py-4">
					<label class="flex cursor-pointer items-start gap-4">
						<input
							type="checkbox"
							class="checkbox mt-1 checkbox-sm"
							checked={on}
							onchange={() => toggle(extra.id)}
						/>
						<span class="min-w-0 flex-1">
							<span class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span class="display text-lg">{extra.name}</span>
								{#if extra.badge}
									<span
										class="border border-base-content/30 px-1.5 py-0.5 text-[0.6rem] tracking-wider uppercase opacity-60"
									>
										{extra.badge}
									</span>
								{/if}
							</span>
							<span class="mt-1 block text-sm leading-relaxed opacity-65">{extra.blurb}</span>
						</span>
						<span class="shrink-0 text-right">
							<span class="display text-lg">{money.format(extra.price)}</span>
							{#if extra.per}
								<span class="block text-xs opacity-50">{extra.per}</span>
							{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>

		<div class="mt-8 flex flex-wrap items-baseline justify-between gap-4">
			<p class="text-sm opacity-60">
				The arrangement, {formatDateInZone(plan.serviceAt, zone)}
			</p>
			<p class="text-right">
				<span class="display text-3xl tabular-nums">{money.format(total)}</span>
				{#if monthly > 0}
					<span class="block text-xs opacity-55">
						and {money.format(monthly)} a month, indefinitely
					</span>
				{/if}
			</p>
		</div>

		<div class="mt-8 flex flex-wrap items-center gap-6 pb-6">
			<button class="btn btn-lg btn-primary" onclick={onward}> Add these and continue </button>
			<!--
				The decline. Small, grey, and phrased so that taking it feels like a
				verdict on how much you loved her — which is precisely how this is
				done, and precisely why it is worth putting on a screen.
			-->
			<button class="link text-sm link-hover opacity-45" onclick={decline}>
				No thank you — {firstName} would have understood.
			</button>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-lg">
		<h1 class="display text-3xl">The arrangement is held.</h1>
		<p class="mt-3 leading-relaxed opacity-70">
			The details were only on the page you were sent to, and refreshing loses them by design. A
			director will telephone you.
		</p>
		<a href={resolve('/')} class="btn mt-8 btn-primary">Back to the beginning</a>
	</div>
{/if}
