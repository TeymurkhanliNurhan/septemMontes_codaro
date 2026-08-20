<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PublicBookingResponse } from '$lib/api/schemas';
	import { formatDateInZone, formatInZone } from '$lib/time';

	// There is deliberately no public GET for a booking by id — that would let
	// anyone enumerate bookings. The POST response and the org zone arrive here
	// through navigation state, so a hard refresh (which loses the state) shows
	// the fallback instead of the details.
	const booking = $derived(page.state.booking as PublicBookingResponse | undefined);
	const zone = $derived(page.state.zone as string | undefined);
</script>

{#if booking}
	<div class="mx-auto max-w-lg text-center">
		<h1 class="mb-4 text-3xl font-bold">Booking received</h1>
		<p class="mb-6 opacity-70">We have your request. The organization will confirm it shortly.</p>
		<div class="card bg-base-200 shadow-md">
			<div class="card-body text-left">
				<h2 class="card-title">{booking.serviceName}</h2>
				<p class="font-semibold">
					{formatDateInZone(booking.startsAt, zone ?? 'UTC')} ·
					{formatInZone(booking.startsAt, zone ?? 'UTC')}
					{#if zone}<span class="font-normal opacity-70">({zone})</span>{/if}
				</p>
				<p>with {booking.resourceName}</p>
				<span class="mt-2 badge badge-warning">{booking.status} — awaiting confirmation</span>
			</div>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-lg text-center">
		<h1 class="mb-4 text-3xl font-bold">Booking received</h1>
		<p class="mb-6 opacity-70">
			Your request went through. The details are only shown on the page you were sent to —
			refreshing loses them, by design.
		</p>
		<a href={resolve('/')} class="btn btn-primary">Back to the start</a>
	</div>
{/if}
