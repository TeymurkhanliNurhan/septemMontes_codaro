<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="mx-auto w-full max-w-4xl px-5 py-16 sm:py-24">
	<p class="eyebrow settle">Track B · Booking and resource scheduling</p>
	<h1 class="display settle mt-4 text-4xl leading-[1.08] sm:text-6xl">
		Booking software for the one customer who
		<span class="marker">will never leave a review.</span>
	</h1>
	<p class="settle mt-7 max-w-2xl text-lg leading-relaxed opacity-75">
		Septem Funeral schedules funerals. The person the booking is for has died, somebody else is
		paying, and not one of them gets to pick the date — a coroner does, or a religion does, or the
		only crematorium in the city does. So we stopped showing a calendar and started showing the
		reasoning.
	</p>

	<div class="settle mt-9 flex flex-wrap items-center gap-3">
		<a href={resolve('/septem')} class="btn btn-lg btn-primary">Begin an arrangement</a>
		<a href={resolve('/septem/director')} class="btn btn-ghost btn-lg">Director's console</a>
	</div>

	<div class="mt-20 grid gap-5 sm:grid-cols-3">
		<div class="settle border-t-2 border-base-content pt-5">
			<p class="eyebrow">Nobody picks</p>
			<h2 class="display mt-2 text-xl">The date is derived</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				Time of death, coroner's release, what the faith asks, which relative is still in the air.
				Five constraints go in, a window comes out, and the app shows its working rather than
				asserting a Tuesday.
			</p>
		</div>
		<div class="settle border-t-2 border-base-content pt-5">
			<p class="eyebrow">Five bookings, one funeral</p>
			<h2 class="display mt-2 text-xl">It is a chain</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				Preparation, viewing, service, hearse, committal — each depending on the last, across six
				kinds of resource. The family chooses between whole plans. There is no slot grid anywhere in
				this product.
			</p>
		</div>
		<div class="settle border-t-2 border-base-content pt-5">
			<p class="eyebrow">The thing that runs out</p>
			<h2 class="display mt-2 text-xl">Cold storage</h2>
			<p class="mt-2 text-sm leading-relaxed opacity-70">
				A chapel is busy for an hour. A refrigerated bay is occupied for nine days. Both are
				resources, only one of them is a countdown, and the home has three.
			</p>
		</div>
	</div>

	<div class="hairline mt-20 pb-5">
		<p class="eyebrow">Three people, and the software keeps them apart</p>
	</div>
	<dl class="mt-7 grid gap-8 sm:grid-cols-3">
		<div>
			<dt class="display text-lg">The deceased</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				Cannot fill in a form, accept your terms, or click the link in a confirmation email. The
				subject of the booking, and never a user of it.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">The arranger</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				A daughter, an executor, a neighbour who volunteered and now regrets it. Makes every
				decision and settles none of the bill.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">The payer</dt>
			<dd class="mt-1.5 text-sm leading-relaxed opacity-70">
				An estate, an insurer, a brother in Chicago. Asked for by name at intake, because finding
				out afterwards is how a grieving family gets invoiced twice.
			</dd>
		</div>
	</dl>
</div>
