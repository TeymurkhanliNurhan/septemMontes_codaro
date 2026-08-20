<script lang="ts">
	import ServiceCard from '$lib/components/ServiceCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { services } = $derived(data);
</script>

<h1 class="mb-1 text-2xl font-bold">{data.organization.name}</h1>
<p class="mb-6 text-sm opacity-70">Choose a service to book</p>

{#if services.length === 0}
	<div class="rounded-box bg-base-200 p-8 text-center">
		<p class="text-lg">Nothing bookable here yet.</p>
		<p class="mt-2 text-sm opacity-70">
			Check back soon — this organization has not published any services.
		</p>
	</div>
{:else}
	<div class="grid gap-4 sm:grid-cols-2">
		{#each services as service (service.id)}
			<ServiceCard {service} slug={data.organization.slug} />
		{/each}
	</div>
{/if}
