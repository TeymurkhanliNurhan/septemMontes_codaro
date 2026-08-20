/** A half-open interval [start, end) in UTC epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** Sorts by start and coalesces anything overlapping or touching. Filters out degenerate intervals where end <= start. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) return [];

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
 * interval splits it in two. Output is normalized: sorted by start, disjoint,
 * with zero-length remnants discarded. This normalization applies regardless of
 * input order.
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

  // Defensive: mergeIntervals now filters degenerate intervals, and both split
  // branches use strict inequalities, so this cannot currently fire.
  return remaining.filter((window) => window.end > window.start);
}

/**
 * Widens an interval by applying before/after buffers. Buffers are expected to
 * be non-negative.
 */
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
