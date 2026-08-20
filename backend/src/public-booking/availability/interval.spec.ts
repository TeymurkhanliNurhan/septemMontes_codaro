import { expandInterval, mergeIntervals, subtractIntervals } from './interval';

const at = (h: number, m = 0) => Date.UTC(2026, 7, 24, h, m);
const iv = (sh: number, eh: number) => ({ start: at(sh), end: at(eh) });

describe('mergeIntervals', () => {
  it('returns an empty array unchanged', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('sorts and coalesces overlapping intervals', () => {
    expect(mergeIntervals([iv(13, 15), iv(9, 12), iv(11, 14)])).toEqual([
      iv(9, 15),
    ]);
  });

  it('coalesces intervals that merely touch', () => {
    expect(mergeIntervals([iv(9, 12), iv(12, 14)])).toEqual([iv(9, 14)]);
  });

  it('keeps disjoint intervals separate', () => {
    expect(mergeIntervals([iv(9, 10), iv(13, 14)])).toEqual([
      iv(9, 10),
      iv(13, 14),
    ]);
  });
});

describe('subtractIntervals', () => {
  it('returns the base untouched when nothing overlaps', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(18, 19)])).toEqual([iv(9, 17)]);
  });

  it('splits a window when a cut lands in the middle', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(12, 13)])).toEqual([
      iv(9, 12),
      iv(13, 17),
    ]);
  });

  it('trims the leading edge', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(8, 10)])).toEqual([iv(10, 17)]);
  });

  it('trims the trailing edge', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(16, 20)])).toEqual([iv(9, 16)]);
  });

  it('removes a window swallowed whole', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(8, 18)])).toEqual([]);
  });

  it('drops zero-length remnants', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(9, 17)])).toEqual([]);
  });

  it('applies several cuts to several windows', () => {
    expect(
      subtractIntervals([iv(9, 12), iv(13, 17)], [iv(10, 11), iv(14, 16)]),
    ).toEqual([iv(9, 10), iv(11, 12), iv(13, 14), iv(16, 17)]);
  });
});

describe('expandInterval', () => {
  it('widens an interval on both sides', () => {
    const minute = 60_000;
    expect(expandInterval(iv(10, 11), 15 * minute, 30 * minute)).toEqual({
      start: at(9, 45),
      end: at(11, 30),
    });
  });
});
