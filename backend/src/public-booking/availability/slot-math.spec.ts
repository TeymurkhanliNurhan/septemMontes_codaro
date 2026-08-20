import { computeSlots, mergeResourceSlots } from './slot-math';

const at = (h: number, m = 0) => Date.UTC(2026, 7, 24, h, m);
const iv = (sh: number, eh: number) => ({ start: at(sh), end: at(eh) });
const MIN = 60_000;

describe('computeSlots', () => {
  it('steps a window into back-to-back slots', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(10, 11), iv(11, 12)]);
  });

  it('yields nothing when the window is shorter than the duration', () => {
    expect(
      computeSlots({
        windows: [iv(9, 10)],
        busy: [],
        durationMs: 90 * MIN,
        bufferBeforeMs: 0,
        bufferAfterMs: 0,
        notBefore: 0,
      }),
    ).toEqual([]);
  });

  it('drops the partial tail of a window', () => {
    const slots = computeSlots({
      windows: [{ start: at(9), end: at(10, 30) }],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10)]);
  });

  it('removes slots colliding with a booking', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [iv(10, 11)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(11, 12)]);
  });

  it('widens a booking by the service buffers', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [iv(10, 11)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 15 * MIN,
      bufferAfterMs: 15 * MIN,
      notBefore: 0,
    });

    // 09:45-11:15 is blocked, so neither the 09:00 nor the 11:00 slot fits.
    expect(slots).toEqual([]);
  });

  it('keeps an exact-fit gap between two bookings', () => {
    const slots = computeSlots({
      windows: [iv(9, 13)],
      busy: [iv(9, 10), iv(11, 13)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(10, 11)]);
  });

  it('steps each surviving window from its own start', () => {
    const slots = computeSlots({
      windows: [iv(9, 11), iv(14, 16)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(10, 11), iv(14, 15), iv(15, 16)]);
  });

  it('drops slots starting before notBefore', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: at(10, 30),
    });

    expect(slots).toEqual([iv(11, 12)]);
  });

  it('returns empty for zero duration', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 0,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([]);
  });

  it('returns empty for negative duration', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: -60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([]);
  });

  it('applies bufferBefore to prevent slots before a booking', () => {
    const slots = computeSlots({
      windows: [iv(9, 13)],
      busy: [{ start: at(11), end: at(11, 30) }],
      durationMs: 60 * MIN,
      bufferBeforeMs: 60 * MIN,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    // 10:00-11:00 is blocked by bufferBefore, so 09:00 and 11:30 slots are available.
    expect(slots).toEqual([iv(9, 10), { start: at(11, 30), end: at(12, 30) }]);
  });

  it('applies bufferAfter to prevent slots after a booking', () => {
    const slots = computeSlots({
      windows: [iv(9, 13)],
      busy: [{ start: at(11), end: at(11, 30) }],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 60 * MIN,
      notBefore: 0,
    });

    // 11:30-12:30 is blocked by bufferAfter, so 09:00 and 10:00 slots are available.
    expect(slots).toEqual([iv(9, 10), iv(10, 11)]);
  });

  it('keeps a slot starting exactly at notBefore', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: at(10),
    });

    // Slots starting exactly at notBefore are included (inclusive boundary).
    expect(slots).toEqual([iv(10, 11), iv(11, 12)]);
  });

  it('merges overlapping availability windows', () => {
    const slots = computeSlots({
      windows: [iv(9, 11), iv(10, 13)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    // Overlapping windows are merged to 09:00-13:00, yielding four slots.
    expect(slots).toEqual([iv(9, 10), iv(10, 11), iv(11, 12), iv(12, 13)]);
  });
});

describe('mergeResourceSlots', () => {
  it('collapses a slot free on two resources into one entry', () => {
    const merged = mergeResourceSlots([
      { resourceId: 'r1', slots: [iv(9, 10), iv(10, 11)] },
      { resourceId: 'r2', slots: [iv(10, 11)] },
    ]);

    expect(merged).toEqual([
      { start: at(9), end: at(10), resourceIds: ['r1'] },
      { start: at(10), end: at(11), resourceIds: ['r1', 'r2'] },
    ]);
  });

  it('returns results sorted by start time', () => {
    const merged = mergeResourceSlots([
      { resourceId: 'r1', slots: [iv(14, 15)] },
      { resourceId: 'r2', slots: [iv(9, 10)] },
    ]);

    expect(merged.map((slot) => slot.start)).toEqual([at(9), at(14)]);
  });

  it('handles a resource with no free slots', () => {
    expect(
      mergeResourceSlots([
        { resourceId: 'r1', slots: [] },
        { resourceId: 'r2', slots: [iv(9, 10)] },
      ]),
    ).toEqual([{ start: at(9), end: at(10), resourceIds: ['r2'] }]);
  });
});
