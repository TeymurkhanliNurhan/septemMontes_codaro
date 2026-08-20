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
		// ISO dates are midnight UTC; pure ms arithmetic keeps the Date
		// instances immutable.
		const startMs = Date.parse(`${weekStart}T00:00:00.000Z`);
		const startLabel = DAY_FORMAT.format(new Date(startMs));
		const endLabel = DAY_FORMAT.format(new Date(startMs + 6 * 86_400_000));
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
