import {
  expandInterval,
  Interval,
  mergeIntervals,
  subtractIntervals,
} from './interval';

export interface SlotInput {
  /** Availability windows, already resolved against rules and exceptions. */
  windows: Interval[];
  /** Raw busy intervals from existing bookings, before buffers. */
  busy: Interval[];
  durationMs: number;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  /** Slots starting before this instant are discarded. */
  notBefore: number;
}

export interface MergedSlot {
  start: number;
  end: number;
  resourceIds: string[];
}

/**
 * Turns availability windows into bookable slots for a single resource.
 * Busy intervals are widened by the service buffers before being removed, so
 * a booking blocks the padding around it as well as its own span.
 */
export function computeSlots(input: SlotInput): Interval[] {
  const blocked = input.busy.map((interval) =>
    expandInterval(interval, input.bufferBeforeMs, input.bufferAfterMs),
  );

  const free = subtractIntervals(mergeIntervals(input.windows), blocked);
  const slots: Interval[] = [];

  for (const window of free) {
    for (
      let start = window.start;
      start + input.durationMs <= window.end;
      start += input.durationMs
    ) {
      if (start >= input.notBefore) {
        slots.push({ start, end: start + input.durationMs });
      }
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

/**
 * Collapses per-resource slot lists into one list keyed by start instant.
 * A slot free on three resources appears once, carrying all three ids, so the
 * consumer sees availability rather than inventory.
 */
export function mergeResourceSlots(
  perResource: Array<{ resourceId: string; slots: Interval[] }>,
): MergedSlot[] {
  const byStart = new Map<number, MergedSlot>();

  for (const { resourceId, slots } of perResource) {
    for (const slot of slots) {
      const existing = byStart.get(slot.start);
      if (existing) {
        if (!existing.resourceIds.includes(resourceId)) {
          existing.resourceIds.push(resourceId);
        }
      } else {
        byStart.set(slot.start, {
          start: slot.start,
          end: slot.end,
          resourceIds: [resourceId],
        });
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.start - b.start);
}
