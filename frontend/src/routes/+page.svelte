<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<!--
	The homepage's job is not to explain the scheduler. Somebody arrives here
	within an hour of the worst telephone call of their life, and what they need
	is to be met, told that little is required of them today, and given a number
	to ring.

	So the humour here is recognition rather than jokes: the absurdity of grief
	arriving with paperwork attached, of a cemetery having opinions about
	Tuesday, of ringing a stranger at three in the morning. Nothing on this page
	is at the expense of the person who died, and nothing on it is a feature.
-->
<div class="mx-auto w-full max-w-4xl px-5 py-16 sm:py-24">
	<p class="settle text-sm opacity-55">A funeral home in Warsaw. Someone answers at every hour.</p>
	<!--
		The break is forced so the highlighted phrase never wraps: left to itself
		the line broke after "the", which left one orphaned word sitting in its own
		ochre box and read as a mistake rather than a mark.
	-->
	<h1 class="display settle mt-4 text-4xl leading-[1.1] sm:text-6xl">
		Come in. Sit down.<br class="hidden sm:inline" />
		Let us do <span class="marker">the difficult parts.</span>
	</h1>
	<p class="settle mt-7 max-w-2xl text-lg leading-relaxed opacity-75">
		Someone has died and — unforgivably — that has produced paperwork, telephone calls, and a
		cemetery with firm opinions about Tuesday. Those are ours. Yours is everything else, at whatever
		pace today turns out to allow.
	</p>

	<div class="settle mt-9 flex flex-wrap items-center gap-4">
		<a href={resolve('/septem')} class="btn btn-lg btn-primary">Begin an arrangement</a>
		<span class="text-sm opacity-60">or telephone us, which most people prefer</span>
	</div>

	<div class="mt-20 grid gap-10 sm:grid-cols-3">
		<div class="settle border-t-2 border-base-content pt-5">
			<h2 class="display text-xl">There is no wrong hour</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				Three in the morning is an entirely ordinary time to ring a funeral home, and you will not
				be the first tonight. Whoever picks up will not sound as though they were asleep. They were.
			</p>
		</div>
		<div class="settle border-t-2 border-base-content pt-5">
			<h2 class="display text-xl">Nothing is decided today</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				Nothing here takes a payment, holds you to anything, or emails you next week to ask whether
				you have finished. We had strong feelings about that last one.
			</p>
		</div>
		<div class="settle border-t-2 border-base-content pt-5">
			<h2 class="display text-xl">We will tell you the truth about the date</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				Not a calendar of hopeful Tuesdays. The day is settled between a coroner, a faith, and a man
				at the cemetery called Piotr. We will show you all three, and you are very welcome to argue
				with any of them.
			</p>
		</div>
	</div>

	<div class="hairline mt-20 pb-5">
		<h2 class="display text-2xl">Who we will be speaking to</h2>
	</div>
	<dl class="mt-7 grid gap-8 sm:grid-cols-3">
		<div>
			<dt class="display text-lg">The person who has died</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				We will ask for their name first, before yours, because they are the reason any of us are
				here. Nothing will be sent to them and nothing will be asked of them.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">You</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				A daughter, an executor, a neighbour who volunteered on the doorstep and has been quietly
				regretting it since. Whoever you are, you are the one we ring.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">Whoever settles the account</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				Usually somebody else — an estate, an insurer, a brother in Chicago who offered on the
				telephone and will be gently held to it. We ask early so that nobody is surprised later.
			</dd>
		</div>
	</dl>

	<div class="mt-20 border-t-2 border-base-content pt-6">
		<p class="max-w-2xl leading-relaxed">
			If you would rather not do any of this on a website — and most people would rather not —
			telephone
			<a href="tel:+48221234567" class="link font-semibold link-hover">+48 22 123 45 67</a>. Someone
			will pick up, and they will have a pen.
		</p>
	</div>
</div>
