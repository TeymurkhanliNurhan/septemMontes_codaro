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
