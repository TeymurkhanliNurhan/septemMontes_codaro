<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<main class="mx-auto w-full max-w-4xl px-4 py-8">
	{@render children()}
</main>
