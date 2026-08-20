<script lang="ts">
	import { resolve } from '$app/paths';
	import DatePager from '$lib/components/DatePager.svelte';
	import BookingForm from '$lib/components/BookingForm.svelte';
	import ResourcePicker from '$lib/components/ResourcePicker.svelte';
	import SlotGrid from '$lib/components/SlotGrid.svelte';
	import { api, ApiError } from '$lib/api/client';
	import type { PublicSlot } from '$lib/api/schemas';
	import { todayInZone, weekFrom } from '$lib/time';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const zone = $derived(data.organization.timezone);
	const slug = $derived(data.organization.slug);
	const service = $derived(data.service);
	const isCustomerChoice = $derived(service.resourceSelectionMode === 'CUSTOMER_CHOICE');

	// Page data is loaded once, so the initial week anchors on the zone the
	// page came with — read through a closure to mark it as deliberately
	// non-reactive.
	function initialDate(): string {
		return todayInZone(data.organization.timezone);
	}
	let weekStart = $state(initialDate());
	let today = $state(initialDate());
	let selectedResourceId = $state<string | undefined>(undefined);
	let selectedSlot = $state<PublicSlot | undefined>(undefined);
	let slots = $state<PublicSlot[]>([]);
	let loading = $state(false);
	let slotsError = $state<string | undefined>(undefined);

	// A non-reactive guard against out-of-order responses when the week or the
	// resource changes mid-flight; only the latest request may land.
	let requestId = 0;

	/**
	 * The one fetch path for slots. Task 16's 409 handler calls this too, so a
	 * taken slot visibly vanishes from the grid without a page reload. The
	 * week and resource are parameters so callers state exactly what they are
	 * fetching (and the `$effect` below tracks them without bare reads).
	 */
	async function reloadSlots(week: string, resourceId: string | undefined): Promise<void> {
		const id = (requestId += 1);
		loading = true;
		slotsError = undefined;
		try {
			const { from, to } = weekFrom(week);
			// Built from a plain object so no URLSearchParams instance is ever
			// mutated in place.
			const params: Record<string, string> = { from, to };
			if (resourceId) params['resourceId'] = resourceId;
			const query = new URLSearchParams(params);
			const result = await api<PublicSlot[]>(
				fetch,
				`/public/orgs/${slug}/services/${service.id}/slots?${query}`
			);
			if (id !== requestId) return;
			slots = result;
		} catch (cause) {
			if (id !== requestId) return;
			slots = [];
			slotsError = cause instanceof ApiError ? cause.message : 'Could not load availability';
		} finally {
			if (id === requestId) loading = false;
		}
	}

	// Reload whenever the visible week or the resource choice changes.
	$effect(() => {
		void reloadSlots(weekStart, selectedResourceId);
	});

	function moveWeek(days: number): void {
		// Pure ms arithmetic keeps the Date instance immutable.
		const next = new Date(Date.parse(`${weekStart}T00:00:00.000Z`) + days * 86_400_000)
			.toISOString()
			.slice(0, 10);
		if (next > today) {
			weekStart = next;
		} else if (next < today) {
			weekStart = today;
		}
	}

	function pickSlot(slot: PublicSlot): void {
		selectedSlot = slot;
	}

	/**
	 * The 409 path: clear the stale selection, then refresh the grid so the
	 * consumer sees the taken slot disappear and can pick another one.
	 */
	async function handleConflict(): Promise<void> {
		selectedSlot = undefined;
		await reloadSlots(weekStart, selectedResourceId);
	}

	/**
	 * On small screens the form mounts below the grid; bring it into view when
	 * it appears. On wide screens it sits beside the grid already, so do
	 * nothing (and `nearest` never yanks a page that already shows it).
	 */
	function scrollIntoView(node: HTMLElement): void {
		if (window.matchMedia('(min-width: 1024px)').matches) return;
		node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
</script>

<a href={resolve(`/${slug}`)} class="mb-3 inline-block link text-sm link-hover opacity-70">
	‹ {data.organization.name}
</a>
<h1 class="mb-1 text-2xl font-bold">{service.name}</h1>
<p class="mb-6 text-sm opacity-70">
	{service.durationMinutes} minutes · All times in {zone}
</p>

<div class="grid gap-8 lg:grid-cols-3">
	<div class={selectedSlot ? '' : 'lg:col-span-3'}>
		{#if isCustomerChoice && data.resources !== null}
			<ResourcePicker
				resources={data.resources}
				selected={selectedResourceId}
				onselect={(resourceId) => (selectedResourceId = resourceId)}
			/>
		{/if}

		<DatePager {weekStart} {today} onprev={() => moveWeek(-7)} onnext={() => moveWeek(7)} />

		{#if loading}
			<div class="my-10 flex justify-center">
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{:else if slotsError}
			<div role="alert" class="my-6 alert alert-error">
				<span>{slotsError}</span>
			</div>
		{:else if slots.length === 0}
			<div class="my-6 rounded-box bg-base-200 p-8 text-center">
				<p class="text-lg">Nothing open this week.</p>
				<p class="mt-1 text-sm opacity-70">
					No bookable times between {weekStart} and the end of the week.
				</p>
				<button class="btn mt-4 btn-primary" onclick={() => moveWeek(7)}> Try next week </button>
			</div>
		{:else}
			<SlotGrid {slots} {weekStart} {zone} selected={selectedSlot} onselect={pickSlot} />
		{/if}
	</div>

	{#if selectedSlot}
		<div class="self-start lg:sticky lg:top-6" use:scrollIntoView>
			<BookingForm
				{slug}
				serviceId={service.id}
				slot={selectedSlot}
				resourceId={selectedResourceId}
				{zone}
				onconflict={handleConflict}
			/>
		</div>
	{/if}
</div>
