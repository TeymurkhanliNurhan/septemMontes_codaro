import { describe, expect, it } from 'vitest';
import { formatInZone, groupSlotsByLocalDay, weekFrom } from './time';

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
