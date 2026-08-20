/** A half-open interval [start, end) in UTC epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** Sorts by start and coalesces anything overlapping or touching. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Removes every part of `cuts` from `base`. A cut landing inside a base
 * interval splits it in two. Zero-length remnants are discarded.
 */
export function subtractIntervals(
  base: Interval[],
  cuts: Interval[],
): Interval[] {
  const collapsed = mergeIntervals(cuts);
  let remaining = mergeIntervals(base);

  for (const cut of collapsed) {
    const next: Interval[] = [];

    for (const window of remaining) {
      if (cut.end <= window.start || cut.start >= window.end) {
        next.push(window);
        continue;
      }
      if (window.start < cut.start) {
        next.push({ start: window.start, end: cut.start });
      }
      if (cut.end < window.end) {
        next.push({ start: cut.end, end: window.end });
      }
    }

    remaining = next;
  }

  return remaining.filter((window) => window.end > window.start);
}

/** Widens an interval, used to apply a service's before/after buffers. */
export function expandInterval(
  interval: Interval,
  beforeMs: number,
  afterMs: number,
): Interval {
  return {
    start: interval.start - beforeMs,
    end: interval.end + afterMs,
  };
}
