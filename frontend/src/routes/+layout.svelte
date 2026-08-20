<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// The director's console is the home's own screen, not the family's. It
	// gets the same chrome but says so, so nobody demonstrating this confuses
	// the two sides of the product.
	// Matches the login screen too, which is as much the home's page as the
	// board behind it and should not wear the family's telephone number.
	const staff = $derived(page.url.pathname.includes('/director'));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col overflow-x-clip bg-base-100">
	<header class="hairline">
		<div class="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-4 px-5 py-5">
			<a href={resolve('/')} class="display text-xl tracking-tight">
				Septem <span class="text-primary">Funeral</span>
			</a>
			{#if staff}
				<span class="eyebrow">Director's console</span>
			{:else}
				<a href="tel:+48221234567" class="text-sm opacity-60 hover:opacity-100">
					Someone is on the line, day and night — +48 22 123 45 67
				</a>
			{/if}
		</div>
	</header>

	<main class="flex-1">{@render children()}</main>

	<footer class="hairline mt-16 border-t border-b-0">
		<div
			class="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-3 px-5 py-6 text-xs opacity-50"
		>
			<span>Septem Funeral · Warsaw</span>
			<span>
				No countdown timers, no “only 2 slots left”, no abandoned-cart email. We considered them for
				about a second.
			</span>
		</div>
	</footer>
</div>
