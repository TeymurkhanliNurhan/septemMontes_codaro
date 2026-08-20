import { describe, expect, it } from 'vitest';
import { formatInZone, fromZonedInput, groupSlotsByLocalDay, toZonedInput, weekFrom } from './time';

describe('weekFrom', () => {
	it('returns seven consecutive dates', () => {
		expect(weekFrom('2026-08-24')).toEqual({
			from: '2026-08-24',
			to: '2026-08-30'
		});
	});

	it('crosses a month boundary', () => {
		expect(weekFrom('2026-08-30')).toEqual({
			from: '2026-08-30',
			to: '2026-09-05'
		});
	});

	it('rejects a malformed date', () => {
		expect(() => weekFrom('not-a-date')).toThrow(/not-a-date/);
	});
});

describe('formatInZone', () => {
	it('renders a UTC instant in the org timezone', () => {
		expect(formatInZone('2026-08-24T06:00:00.000Z', 'Europe/Istanbul')).toBe('09:00');
	});
});

describe('zoned datetime-local inputs', () => {
	it('shows an instant as the wall time the home reads', () => {
		expect(toZonedInput('2026-08-24T06:00:00.000Z', 'Europe/Warsaw')).toBe('2026-08-24T08:00');
	});

	it('round-trips through the organization zone', () => {
		const instant = '2026-08-24T06:00:00.000Z';
		expect(fromZonedInput(toZonedInput(instant, 'Europe/Warsaw'), 'Europe/Warsaw')).toBe(instant);
	});

	it('reads a wall time on the morning the clocks go back', () => {
		// 01:00 in Warsaw on 2026-10-25 is still summer time; the switch to
		// +01:00 happens an hour later, at 03:00 local.
		expect(fromZonedInput('2026-10-25T01:00', 'Europe/Warsaw')).toBe('2026-10-24T23:00:00.000Z');
	});

	it('rejects a malformed local time', () => {
		expect(() => fromZonedInput('not-a-time', 'Europe/Warsaw')).toThrow(/not-a-time/);
	});
});

describe('groupSlotsByLocalDay', () => {
	it('buckets slots by their date in the org timezone', () => {
		const slots = [
			{ startsAt: '2026-08-24T06:00:00.000Z', endsAt: '', resourceIds: [] },
			{ startsAt: '2026-08-24T07:00:00.000Z', endsAt: '', resourceIds: [] },
			{ startsAt: '2026-08-25T06:00:00.000Z', endsAt: '', resourceIds: [] }
		];

		const grouped = groupSlotsByLocalDay(slots, 'Europe/Istanbul');
		expect([...grouped.keys()]).toEqual(['2026-08-24', '2026-08-25']);
		expect(grouped.get('2026-08-24')).toHaveLength(2);
	});
});
