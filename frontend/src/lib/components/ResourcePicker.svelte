<script lang="ts">
	import type { PublicResource } from '$lib/api/schemas';

	let {
		resources,
		selected,
		onselect
	}: {
		resources: PublicResource[];
		selected: string | undefined;
		onselect: (resourceId: string | undefined) => void;
	} = $props();

	function choose(resourceId: string | undefined) {
		onselect(resourceId);
	}
</script>

<fieldset class="mb-6">
	<legend class="mb-2 text-sm font-semibold opacity-80">Who should take it?</legend>
	<div class="join">
		<input
			type="radio"
			name="resource"
			class="btn join-item"
			aria-label="Any available"
			checked={selected === undefined}
			onchange={() => choose(undefined)}
		/>
		{#each resources as resource (resource.id)}
			<input
				type="radio"
				name="resource"
				class="btn join-item"
				aria-label={resource.name}
				checked={selected === resource.id}
				onchange={() => choose(resource.id)}
			/>
		{/each}
	</div>
</fieldset>
