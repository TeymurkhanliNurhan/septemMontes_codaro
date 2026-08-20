<script lang="ts">
	import { resolve } from '$app/paths';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="navbar bg-base-200 shadow-sm">
		<div class="navbar-start">
			<a href={resolve('/')} class="btn btn-ghost text-xl">Bookings</a>
		</div>
		<div class="navbar-end">
			<span class="badge badge-outline">Guest booking</span>
		</div>
	</header>

	<main class="flex-1">{@render children()}</main>

	<footer class="footer footer-center bg-base-200 p-4 text-sm opacity-70">
		<aside>Book with a name and an email — no account needed.</aside>
	</footer>
</div>
