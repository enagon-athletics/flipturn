import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readEv3 } from '../../src/ev3/index.js';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/ev3/meet.ev3', import.meta.url)));

describe('readEv3', () => {
	const result = readEv3(bytes);
	const { meet } = result;

	test('reads the meet header', () => {
		expect(result.format).toBe('ev3');
		expect(result.source).toEqual({
			software: 'Created by Synthetic MM',
			version: '1.0',
			createdAt: '2026-09-01'
		});
		expect(meet).toMatchObject({
			name: 'Synthetic Fall Classic',
			host: { name: 'Harbour Pool' },
			startDate: '2026-10-17',
			endDate: '2026-10-18',
			ageUpDate: '2026-12-31',
			entryDeadline: '2026-10-10',
			sanction: 'BC-2026-001',
			course: 'SCM',
			address: {
				line1: '100 Harbour Way',
				city: 'Victoria',
				state: 'BC',
				postalCode: 'V8V 1A1',
				country: 'CAN'
			}
		});
		expect(meet.swimmers).toEqual([]);
		expect(meet.entries).toEqual([]);
	});

	test('keeps girls, boys, women, men and mixed codes', () => {
		expect(meet.events.map((e) => `${e.number}:${e.sexCode}:${e.gender}`)).toEqual([
			'1:G:F',
			'2:B:M',
			'3A:W:F',
			'4:M:M',
			'5:X:X',
			'6:G:F'
		]);
	});

	test('reads an event in full', () => {
		expect(meet.events[2]).toEqual({
			id: '3A',
			number: '3A',
			type: 'individual',
			gender: 'F',
			sexCode: 'W',
			distance: 200,
			stroke: 'IM',
			course: 'SCM',
			ageBand: { min: 15, max: null },
			prelimsFinals: true,
			rounds: 2,
			entryFee: 7,
			qualifyingTimes: {
				LCM: { kind: 'time', hundredths: 16000 },
				SCM: { kind: 'time', hundredths: 15500 },
				SCY: { kind: 'time', hundredths: 14500 }
			},
			sessionId: '2',
			sessionOrder: 1
		});
	});

	test('reads relays, and falls back to the meet course for a blank one', () => {
		expect(meet.events[4]).toMatchObject({ type: 'relay', stroke: 'MEDLEY', relayLegs: 4 });
		expect(meet.events[5]).toMatchObject({ type: 'relay', stroke: 'FREE', course: 'SCM' });
		expect(meet.events[0]).not.toHaveProperty('qualifyingTimes');
	});

	test('derives sessions', () => {
		expect(meet.sessions).toEqual([
			{ id: '1', day: 1, startTime: '09:00', eventCount: 2 },
			{ id: '2', day: 2, startTime: '17:00', eventCount: 4 }
		]);
	});

	test('keeps raw records', () => {
		expect(result.records).toHaveLength(7);
		expect(result.records[1]).toMatchObject({ code: 'event', line: 2 });
	});

	test('throws on an unknown event sex code rather than guessing mixed', () => {
		const text = new TextDecoder('latin1').decode(bytes).replace(';I;G;0;10;', ';I;P;0;10;');
		expect(() => readEv3(text)).toThrow('unknown event sex code "P" on event 1');
	});

	test('nulls placeholder dates and cuts only when asked', () => {
		const text = new TextDecoder('latin1')
			.decode(bytes)
			.replace('12/31/2026', '01/01/1970')
			.replace(';;1:25.00;;', ';;0.01;;');
		expect(readEv3(text).meet.ageUpDate).toBe('1970-01-01');
		const nulled = readEv3(text, { placeholders: 'null' }).meet;
		expect(nulled.ageUpDate).toBeUndefined();
		expect(nulled.events[1]?.qualifyingTimes).not.toHaveProperty('SCM');
	});
});
