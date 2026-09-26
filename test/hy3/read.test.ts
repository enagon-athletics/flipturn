import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hy3Checksum, readHy3 } from '../../src/hy3/index.js';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/hy3/results.hy3', import.meta.url)));
const text = new TextDecoder('latin1').decode(bytes);

describe('hy3Checksum', () => {
	test('matches every line of the fixture', () => {
		for (const line of text.split('\r\n').filter(Boolean)) {
			expect(hy3Checksum(line)).toBe(line.slice(128, 130));
		}
	});

	test('reverses the last two digits of floor(sum / 21) + 205', () => {
		// 'A' * 1 + 'B' * 2 = 197; floor(197 / 21) + 205 = 214 -> "14" -> "41".
		expect(hy3Checksum('AB')).toBe('41');
	});
});

describe('readHy3', () => {
	const result = readHy3(bytes);
	const { meet } = result;

	test('reads source, meet and team', () => {
		expect(result.format).toBe('hy3');
		expect(result.source).toEqual({ software: 'Synthetic MM', createdAt: '2026-10-05' });
		expect(meet).toMatchObject({
			name: 'Synthetic Autumn Invitational',
			startDate: '2026-10-03',
			course: 'SCM'
		});
		expect(meet.teams).toEqual([{ code: 'HSC', name: 'Harbour Swim Club' }]);
		expect(result.warnings).toEqual([]);
	});

	test('reads athletes with their ids', () => {
		expect(meet.swimmers[0]).toEqual({
			id: 'tern|ada|2012-03-14',
			lastName: 'Tern',
			firstName: 'Ada',
			middleInitial: 'M',
			preferredName: 'Addie',
			gender: 'F',
			birthDate: '2012-03-14',
			teamCode: 'HSC',
			externalIds: [
				{ system: 'hy3:athlete-number', value: '1' },
				{ system: 'hy3:registration', value: 'ADA0001' }
			]
		});
		expect(meet.swimmers).toHaveLength(3);
	});

	test('preserves girls, boys and women event sex codes', () => {
		expect(meet.events.map((e) => [e.number, e.sexCode, e.gender])).toEqual([
			['1', 'G', 'F'],
			['2A', 'B', 'M'],
			['5', 'W', 'F'],
			['4', 'G', 'F']
		]);
		expect(meet.events[1]?.ageBand).toEqual({ min: 15, max: null });
		expect(meet.events[2]?.ageBand).toEqual({ min: null, max: null });
	});

	test('merges the per-round records of one swim into one entry', () => {
		expect(meet.entries[0]).toEqual({
			kind: 'individual',
			eventId: '1',
			swimmerId: 'tern|ada|2012-03-14',
			teamCode: 'HSC',
			seedTime: { kind: 'time', hundredths: 6532 },
			results: [
				{
					round: 'prelim',
					time: { kind: 'time', hundredths: 6410 },
					status: 'ok',
					place: 5,
					heat: 2,
					lane: 4
				},
				{
					round: 'final',
					time: { kind: 'time', hundredths: 6355 },
					status: 'ok',
					place: 2,
					heat: 1,
					lane: 3
				}
			]
		});
	});

	test('keeps the swum time and reason on a DQ', () => {
		expect(meet.entries[1]).toMatchObject({
			eventId: '2A',
			results: [
				{
					round: 'final',
					time: { kind: 'time', hundredths: 15045 },
					status: 'dq',
					dqCode: '5F',
					dqReason: 'Kick: Alternating kick'
				}
			]
		});
		expect(meet.entries[1]).not.toHaveProperty('seedTime');
	});

	test('reads a relay and its legs', () => {
		const relay = meet.entries.find((e) => e.kind === 'relay');
		expect(relay).toMatchObject({
			eventId: '4',
			teamCode: 'HSC',
			relayLetter: 'A',
			seedTime: { kind: 'time', hundredths: 13000 },
			results: [{ round: 'final', time: { kind: 'time', hundredths: 12550 }, place: 1 }]
		});
		expect(relay?.kind === 'relay' && relay.legs).toEqual([
			{ swimmerId: 'tern|ada|2012-03-14', name: 'Tern, Ada M', order: 1 },
			{ swimmerId: 'gannet|cleo|2012-11-30', name: 'Gannet, Cleo', order: 2 },
			{ name: 'Skua', order: 3 },
			{ name: 'Auk', order: 4 }
		]);
	});

	test('keeps raw records', () => {
		expect(result.records.map((r) => r.code).slice(0, 4)).toEqual(['A1', 'B1', 'C1', 'D1']);
	});
});

describe('readHy3 checksum handling', () => {
	const tampered = text.replace('Harbour Swim Club', 'Harbour Swim Clux');

	test('warns once, naming the count and first line', () => {
		expect(readHy3(tampered).warnings).toEqual([
			'1 line(s) failed the HY3 checksum; first at line 3'
		]);
	});

	test('throws in strict mode and stays quiet when ignored', () => {
		expect(() => readHy3(tampered, { checksum: 'error' })).toThrow(
			'HY3 checksum mismatch on line 3'
		);
		expect(readHy3(tampered, { checksum: 'ignore' }).warnings).toEqual([]);
	});

	test('skips lines without a checksum', () => {
		const short = text
			.split('\r\n')
			.map((l) => l.slice(0, 128).trimEnd())
			.join('\r\n');
		expect(readHy3(short).warnings).toEqual([]);
	});
});
