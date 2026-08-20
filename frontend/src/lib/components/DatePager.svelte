<script lang="ts">
	const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});

	let {
		weekStart,
		today,
		onprev,
		onnext
	}: {
		weekStart: string;
		today: string;
		onprev: () => void;
		onnext: () => void;
	} = $props();

	// ISO dates compare lexicographically, so the floor check is a plain
	// string comparison.
	const canGoBack = $derived(weekStart > today);

	function rangeLabel(): string {
		const end = new Date(`${weekStart}T00:00:00.000Z`);
		end.setUTCDate(end.getUTCDate() + 6);
		const endLabel = DAY_FORMAT.format(end);
		const startLabel = DAY_FORMAT.format(new Date(`${weekStart}T00:00:00.000Z`));
		return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<button class="btn btn-outline btn-sm" disabled={!canGoBack} onclick={onprev}>
		‹ Previous
	</button>
	<span class="font-semibold">{rangeLabel()}</span>
	<button class="btn btn-outline btn-sm" onclick={onnext}>Next ›</button>
</div>
