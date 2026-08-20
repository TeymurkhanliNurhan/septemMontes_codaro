<script lang="ts">
	import { goto } from '$app/navigation';
	import { api, ApiError } from '$lib/api/client';
	import type { PublicBookingResponse, PublicSlot } from '$lib/api/schemas';
	import { formatDateInZone, formatInZone } from '$lib/time';

	let {
		slug,
		serviceId,
		slot,
		resourceId,
		zone,
		onconflict
	}: {
		slug: string;
		serviceId: string;
		slot: PublicSlot;
		resourceId: string | undefined;
		zone: string;
		/** Called on a 409 so the grid refreshes and the taken slot vanishes. */
		onconflict: () => Promise<void>;
	} = $props();

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let notes = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		formError = undefined;
		try {
			const booking = await api<PublicBookingResponse>(fetch, `/public/orgs/${slug}/bookings`, {
				method: 'POST',
				body: JSON.stringify({
					serviceId,
					startsAt: slot.startsAt,
					resourceId,
					customer: {
						name: name.trim(),
						email: email.trim(),
						phone: phone.trim() || undefined
					},
					notes: notes.trim() || undefined
				})
			});
			await goto(`/${slug}/booking/${booking.bookingId}`, {
				state: { booking, zone }
			});
		} catch (cause) {
			if (cause instanceof ApiError && cause.status === 409) {
				// The slot list the consumer is holding is stale. Clear the
				// selection and reload so they SEE the taken slot vanish and
				// can pick another one without a page reload.
				formError = 'Someone just took that time. Here are the times still open.';
				await onconflict();
			} else if (cause instanceof ApiError && cause.status === 400) {
				formError = cause.message;
			} else {
				formError = 'Something went wrong. Please try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<div class="card bg-base-200 shadow-md">
	<div class="card-body">
		<h2 class="card-title">Confirm your booking</h2>
		<p class="text-sm font-semibold">
			{formatDateInZone(slot.startsAt, zone)} · {formatInZone(slot.startsAt, zone)}
			<span class="font-normal opacity-70">({zone})</span>
		</p>

		<form onsubmit={submit}>
			<label class="form-control w-full">
				<span class="label-text py-1">Name</span>
				<input
					class="input-bordered input w-full"
					required
					maxlength="255"
					bind:value={name}
					autocomplete="name"
				/>
			</label>
			<label class="form-control w-full">
				<span class="label-text py-1">Email</span>
				<input
					class="input-bordered input w-full"
					type="email"
					required
					maxlength="255"
					bind:value={email}
					autocomplete="email"
				/>
			</label>
			<label class="form-control w-full">
				<span class="label-text py-1">Phone (optional)</span>
				<input
					class="input-bordered input w-full"
					type="tel"
					maxlength="100"
					bind:value={phone}
					autocomplete="tel"
				/>
			</label>
			<label class="form-control w-full">
				<span class="label-text py-1">Notes (optional)</span>
				<textarea class="textarea-bordered textarea w-full" maxlength="2000" bind:value={notes}
				></textarea>
			</label>

			{#if formError}
				<div role="alert" class="my-3 alert alert-error">
					<span>{formError}</span>
				</div>
			{/if}

			<div class="mt-4 card-actions">
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{#if submitting}<span class="loading loading-spinner"></span>{/if}
					{submitting ? 'Booking…' : 'Book this time'}
				</button>
			</div>
		</form>
	</div>
</div>
