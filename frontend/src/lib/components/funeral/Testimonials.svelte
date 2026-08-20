<script lang="ts">
	/**
	 * The social-proof strip every booking site puts above its form, filled in
	 * by the only customers this one has.
	 *
	 * The joke is structural rather than written: the format is exactly a
	 * marketing widget — an aggregate score, a review count, a verified badge,
	 * an endless scroll of five-star cards — and it is the format, applied to
	 * people who are dead, that does the work. So the cards are played straight.
	 * None of them mentions dying, none of them is ghoulish, and the two that
	 * are not five stars are there because a wall of perfect scores reads as
	 * fake, which is a real thing about real review widgets and funnier than
	 * another compliment.
	 */
	interface Review {
		quote: string;
		name: string;
		years: string;
		stars: number;
	}

	const REVIEWS: Review[] = [
		{
			quote: 'Would not do it again.',
			name: 'Halina Kowalczyk',
			years: '1943–2026',
			stars: 5
		},
		{
			quote: 'Everything ran to time. It was the first occasion in my life that anything did.',
			name: 'Jan Wiśniewski',
			years: '1951–2026',
			stars: 5
		},
		{
			quote:
				'My daughter chose the readings. I would have chosen otherwise, and I was not consulted, which I gather is the entire point of this company.',
			name: 'Bogusław Mazur',
			years: '1938–2025',
			stars: 4
		},
		{
			quote: 'Very smooth. I barely noticed.',
			name: 'Teresa Adamczyk',
			years: '1947–2026',
			stars: 5
		},
		{
			quote:
				'The bar for a funeral is that nobody present has to think about the logistics of it. Nobody did.',
			name: 'Andrzej Piotrowski',
			years: '1955–2025',
			stars: 5
		},
		{
			quote: 'Cold storage was colder than advertised.',
			name: 'Marek Zieliński',
			years: '1960–2026',
			stars: 4
		},
		{
			quote: 'Punctual, dignified, and over before I knew it.',
			name: 'Zofia Lewandowska',
			years: '1934–2025',
			stars: 5
		},
		{
			quote:
				'I have nothing whatever but time now, and even I would not have wanted to wait three weeks.',
			name: 'Ryszard Kamiński',
			years: '1949–2026',
			stars: 5
		}
	];

	// The track is rendered twice so the translate can loop seamlessly: at -50%
	// the second copy sits exactly where the first began.
	const TRACK = [...REVIEWS, ...REVIEWS];
</script>

<section aria-label="What our clients say" class="settle">
	<div class="hairline flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-2">
		<p class="eyebrow">What our clients say</p>
		<p class="text-xs opacity-50">
			<span class="text-accent-content">★★★★★</span>
			4.9 out of 5 · 2,847 arrangements · no refund has ever been requested
		</p>
	</div>

	<!--
		Hidden from assistive technology and duplicated for the loop: a screen
		reader should not be read sixteen testimonials to be told twice that a
		dead man found us punctual.
	-->
	<div class="marquee full-bleed mt-4" aria-hidden="true">
		<ul class="marquee-track">
			{#each TRACK as review, index (index)}
				<li class="w-80 shrink-0 border-l border-base-300 px-5">
					<p class="text-xs tracking-wider text-accent-content">
						{'★'.repeat(review.stars)}<span class="opacity-25">{'★'.repeat(5 - review.stars)}</span>
					</p>
					<p class="display mt-2 text-base leading-snug">“{review.quote}”</p>
					<p class="mt-2.5 text-xs opacity-55">
						{review.name} <span class="opacity-70">· {review.years}</span>
					</p>
					<p class="mt-0.5 text-[0.65rem] tracking-wide uppercase opacity-40">
						Verified — deceased
					</p>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.marquee {
		overflow: hidden;
	}

	/*
	 * Breaks out of the padded page column to the full viewport. The ancestor
	 * carries `overflow-x: clip` so this cannot raise a horizontal scrollbar;
	 * `clip` rather than `hidden` because it does not create a scroll container
	 * and so leaves the confirm bar's `position: sticky` working.
	 */
	.full-bleed {
		width: 100vw;
		margin-left: calc(50% - 50vw);
		margin-right: calc(50% - 50vw);
	}

	.marquee-track {
		display: flex;
		width: max-content;
		animation: slide 64s linear infinite;
	}

	/* Reading a testimonial should not be a game of chance. */
	.marquee:hover .marquee-track {
		animation-play-state: paused;
	}

	@keyframes slide {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-track {
			animation: none;
		}
		/* Static, it must still be reachable, so it becomes an ordinary scroller. */
		.marquee {
			overflow-x: auto;
		}
	}
</style>
