import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readHyv } from '../../src/hyv/index.js';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/hyv/meet.hyv', import.meta.url)));

describe('readHyv', () => {
	const result = readHyv(bytes);
	const { meet } = result;

	test('reads the meet header', () => {
		expect(result.format).toBe('hyv');
		expect(result.source).toEqual({ software: 'Synthetic Sports Software', version: '1.0' });
		expect(meet).toMatchObject({
			name: 'Synthetic Fall Classic',
			host: { name: 'Harbour Pool' },
			startDate: '2026-10-17',
			endDate: '2026-10-18',
			ageUpDate: '2026-12-31',
			course: 'SCM'
		});
		expect(meet.sessions).toEqual([]);
	});

	test('reads events with the raw F/M/X sex code', () => {
		expect(meet.events.map((e) => `${e.number}:${e.sexCode}:${e.stroke}`)).toEqual([
			'1:F:FREE',
			'2:M:BACK',
			'3A:F:IM',
			'5:X:MEDLEY'
		]);
	});

	test('reads rotated qualifying-time columns starting at the meet course', () => {
		expect(meet.events[1]).toEqual({
			id: '2',
			number: '2',
			type: 'individual',
			gender: 'M',
			sexCode: 'M',
			distance: 100,
			stroke: 'BACK',
			course: 'SCM',
			ageBand: { min: 11, max: 12 },
			prelimsFinals: false,
			entryFee: 6.5,
			qualifyingTimes: {
				LCM: { kind: 'time', hundredths: 9000 },
				SCM: { kind: 'time', hundredths: 8500 },
				SCY: { kind: 'time', hundredths: 8000 }
			}
		});
	});

	test('reads an upper age of 0 as open', () => {
		expect(meet.events[2]?.ageBand).toEqual({ min: 15, max: null });
		expect(meet.events[3]?.ageBand).toEqual({ min: null, max: null });
	});

	test('carries no meet-level entry limits or fees: hyv has no header field for them', () => {
		expect(meet.entryLimits).toBeUndefined();
		expect(meet.fees).toBeUndefined();
	});
});
