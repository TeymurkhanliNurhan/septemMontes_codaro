<script lang="ts">
	import type { PublicSlot } from '$lib/api/schemas';
	import { formatInZone, groupSlotsByLocalDay } from '$lib/time';

	let {
		slots,
		weekStart,
		zone,
		selected,
		onselect
	}: {
		slots: PublicSlot[];
		weekStart: string;
		zone: string;
		selected: PublicSlot | undefined;
		onselect: (slot: PublicSlot) => void;
	} = $props();

	const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});

	// The seven days of the visible week, in order.
	const days = $derived.by(() => {
		const list: string[] = [];
		const cursor = new Date(`${weekStart}T00:00:00.000Z`);
		for (let index = 0; index < 7; index += 1) {
			list.push(cursor.toISOString().slice(0, 10));
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}
		return list;
	});

	const byDay = $derived(groupSlotsByLocalDay(slots, zone));

	function isSelected(slot: PublicSlot): boolean {
		return selected !== undefined && selected.startsAt === slot.startsAt;
	}
</script>

<div class="grid grid-cols-7 gap-2 text-center">
	{#each days as day (day)}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-semibold opacity-70">
				{DAY_FORMAT.format(new Date(`${day}T00:00:00.000Z`))}
			</span>
			{#if byDay.has(day)}
				{#each byDay.get(day) ?? [] as slot (slot.startsAt)}
					<button
						class="btn btn-outline btn-sm"
						class:btn-primary={isSelected(slot)}
						onclick={() => onselect(slot)}
					>
						{formatInZone(slot.startsAt, zone)}
					</button>
				{/each}
			{:else}
				<span class="text-sm opacity-30">—</span>
			{/if}
		</div>
	{/each}
</div>
