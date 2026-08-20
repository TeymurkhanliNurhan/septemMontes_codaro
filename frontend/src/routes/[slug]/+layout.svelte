<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="navbar bg-base-200 shadow-sm">
	<div class="navbar-start">
		<a href="/" class="btn btn-ghost text-xl">Bookings</a>
	</div>
	<div class="navbar-center">
		<span class="text-lg font-semibold">{data.organization.name}</span>
	</div>
	<div class="navbar-end">
		<span class="badge badge-outline">{data.organization.timezone}</span>
	</div>
</div>

<main class="mx-auto w-full max-w-4xl px-4 py-8">
	{@render children()}
</main>
