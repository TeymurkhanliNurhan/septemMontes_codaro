<script lang="ts">
	import DatePager from '$lib/components/DatePager.svelte';
	import ResourcePicker from '$lib/components/ResourcePicker.svelte';
	import SlotGrid from '$lib/components/SlotGrid.svelte';
	import { api, ApiError } from '$lib/api/client';
	import type { PublicSlot } from '$lib/api/schemas';
	import { todayInZone, weekFrom } from '$lib/time';
	import type { PageData } from './$types';

	let { data } = $props();

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
	 * taken slot visibly vanishes from the grid without a page reload.
	 */
	async function reloadSlots(): Promise<void> {
		const id = (requestId += 1);
		loading = true;
		slotsError = undefined;
		try {
			const { from, to } = weekFrom(weekStart);
			const query = new URLSearchParams({ from, to });
			if (selectedResourceId) query.set('resourceId', selectedResourceId);
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
		weekStart;
		selectedResourceId;
		void reloadSlots();
	});

	function moveWeek(days: number): void {
		const cursor = new Date(`${weekStart}T00:00:00.000Z`);
		cursor.setUTCDate(cursor.getUTCDate() + days);
		const next = cursor.toISOString().slice(0, 10);
		if (next > today) {
			weekStart = next;
		} else if (next < today) {
			weekStart = today;
		}
	}

	function pickSlot(slot: PublicSlot): void {
		selectedSlot = slot;
	}
</script>

<h1 class="mb-2 text-2xl font-bold">{service.name}</h1>
<p class="mb-1 text-sm opacity-70">
	{service.durationMinutes} minutes
	{#if isCustomerChoice}
		· you choose who takes it{/if}
</p>
<p class="mb-6 text-sm font-semibold">All times in {zone}</p>

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

{#if selectedSlot}
	<div class="divider"></div>
	<!-- Task 16: the confirm form appears here once a slot is selected. -->
{/if}
