<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PublicService } from '$lib/api/schemas';

	let { service, slug }: { service: PublicService; slug: string } = $props();
</script>

<a
	href={resolve(`/${slug}/${service.id}`)}
	class="card bg-base-100 shadow-md transition-shadow hover:shadow-lg"
>
	<div class="card-body">
		<h2 class="card-title">{service.name}</h2>
		{#if service.description}
			<p class="text-sm opacity-70">{service.description}</p>
		{/if}
		<div class="card-actions items-center justify-between">
			<span class="badge badge-outline">{service.durationMinutes} min</span>
			<span class="text-sm font-semibold text-primary">Book →</span>
		</div>
	</div>
</a>
