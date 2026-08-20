<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PublicService } from '$lib/api/schemas';

	let { service, slug }: { service: PublicService; slug: string } = $props();
</script>

<div class="card bg-base-100 shadow-md">
	<div class="card-body">
		<h2 class="card-title">{service.name}</h2>
		{#if service.description}
			<p class="text-sm opacity-70">{service.description}</p>
		{/if}
		<div class="card-actions items-center justify-between">
			<span class="badge badge-outline">{service.durationMinutes} min</span>
			<a href={resolve(`/${slug}/${service.id}`)} class="btn btn-primary btn-sm"> Book </a>
		</div>
	</div>
</div>
