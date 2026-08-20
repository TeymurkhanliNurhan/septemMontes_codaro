import { describe, expect, it } from 'vitest';
import { computeWindow, describeSpan, intakeInstant, withCoronerRelease } from './constraints';

/**
 * The window is the one piece of this product a family is asked to trust
 * without being able to check it, so it is the piece with tests.
 */
const DIED = '2026-08-19T20:00:00.000Z';

describe('computeWindow', () => {
	it('holds the coroner release as a hard floor', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'ISLAMIC',
			disposition: 'BURIAL',
			coronerInvolved: true,
			coronerReleaseAt: '2026-08-20T14:00:00.000Z'
		});
		expect(window.earliest).toBe('2026-08-20T14:00:00.000Z');
		expect(window.constraints.find((c) => c.id === 'CORONER')?.binding).toBe(true);
	});

	it('caps the window at the tradition deadline', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'ISLAMIC',
			disposition: 'BURIAL',
			coronerInvolved: false
		});
		// 24 hours after death, and well before the storage limit.
		expect(window.latest).toBe('2026-08-20T20:00:00.000Z');
		expect(window.constraints.find((c) => c.id === 'TRADITION_DEADLINE')?.binding).toBe(true);
	});

	it('falls back to the limit of care when a tradition sets no deadline', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'HUMANIST',
			disposition: 'CREMATION',
			coronerInvolved: false
		});
		expect(window.constraints.find((c) => c.id === 'STORAGE')?.binding).toBe(true);
		expect(window.impossible).toBe(false);
	});

	it('reports impossible when the release lands past the deadline', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'ISLAMIC',
			disposition: 'BURIAL',
			coronerInvolved: true,
			coronerReleaseAt: '2026-08-22T09:00:00.000Z'
		});
		expect(window.impossible).toBe(true);
	});

	it('lets a travelling family push the floor, but marks it a wish', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'CATHOLIC',
			disposition: 'BURIAL',
			coronerInvolved: false,
			familyArrivesAt: '2026-08-24T09:00:00.000Z'
		});
		expect(window.earliest).toBe('2026-08-24T09:00:00.000Z');
		expect(window.constraints.find((c) => c.id === 'FAMILY')?.hard).toBe(false);
	});
});

describe('intakeInstant', () => {
	it('ignores wishes — a travelling relative does not delay collection', () => {
		const window = computeWindow({
			diedAt: DIED,
			traditionId: 'CATHOLIC',
			disposition: 'BURIAL',
			coronerInvolved: true,
			coronerReleaseAt: '2026-08-20T10:00:00.000Z',
			familyArrivesAt: '2026-08-24T09:00:00.000Z'
		});
		expect(window.earliest).toBe('2026-08-24T09:00:00.000Z');
		expect(intakeInstant(window)).toBe('2026-08-20T10:00:00.000Z');
	});
});

describe('withCoronerRelease', () => {
	it('moves the floor and leaves every other fact alone', () => {
		const facts = {
			diedAt: DIED,
			traditionId: 'CATHOLIC' as const,
			disposition: 'BURIAL' as const,
			coronerInvolved: true,
			coronerReleaseAt: '2026-08-20T10:00:00.000Z'
		};
		const moved = withCoronerRelease(facts, '2026-08-23T10:00:00.000Z');
		expect(moved.coronerReleaseAt).toBe('2026-08-23T10:00:00.000Z');
		expect(moved.diedAt).toBe(facts.diedAt);
		expect(computeWindow(moved).earliest).toBe('2026-08-23T10:00:00.000Z');
	});
});

describe('describeSpan', () => {
	it('reads as a person would say it', () => {
		expect(describeSpan(DIED, '2026-08-21T00:00:00.000Z')).toBe('1 day 4 hours');
		expect(describeSpan(DIED, '2026-08-19T20:30:00.000Z')).toBe('under an hour');
	});
});
