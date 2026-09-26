import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readSdif } from '../../src/sdif/index.js';

const fixture = (name: string) =>
	new Uint8Array(readFileSync(new URL(`../fixtures/sdif/${name}`, import.meta.url)));

describe('readSdif on a results file', () => {
	const result = readSdif(fixture('results.sd3'));
	const { meet } = result;

	test('reads file source and meet header', () => {
		expect(result.format).toBe('sdif');
		expect(result.source).toEqual({
			software: 'Synthetic Meet Mgr',
			version: '1.0',
			createdAt: '2026-10-05'
		});
		expect(meet).toMatchObject({
			name: 'Synthetic Autumn Invitational',
			startDate: '2026-10-03',
			endDate: '2026-10-04',
			course: 'SCM',
			meetType: '1',
			address: { city: 'Victoria', state: 'BC', postalCode: 'V8V 1A1', country: 'CAN' },
			host: { name: 'Harbour Swim Club', phone: '2505550101' }
		});
	});

	test('carries no meet-level entry limits or fees: the SDIF spec defines no field for them', () => {
		expect(meet.entryLimits).toBeUndefined();
		expect(meet.fees).toBeUndefined();
	});

	test('reads teams with their coach', () => {
		expect(meet.teams).toEqual([
			{
				code: 'BCHSC',
				name: 'Harbour Swim Club',
				shortName: 'Harbour',
				address: { city: 'Victoria', state: 'BC', country: 'CAN' },
				coach: { name: 'Coach, Casey', phone: '2505550102' }
			},
			{
				code: 'BCOCN',
				name: 'Orca Aquatics',
				shortName: 'Orca',
				address: { city: 'Nanaimo', state: 'BC', country: 'CAN' },
				coach: { name: 'Trainer, Robin' }
			}
		]);
	});

	test('builds one swimmer per person, relay-only swimmers included', () => {
		expect(meet.swimmers.map((s) => `${s.lastName}, ${s.firstName}`)).toEqual([
			'Tern, Ada',
			'Petrel, Ben',
			'Gannet, Cleo',
			'Skua, Dana',
			'Auk, Emma',
			'Loon, Fay',
			'Murre, Gil'
		]);
		expect(meet.swimmers[0]).toEqual({
			id: 'tern|ada|2012-03-14',
			lastName: 'Tern',
			firstName: 'Ada',
			middleInitial: 'M',
			preferredName: 'Addie',
			gender: 'F',
			birthDate: '2012-03-14',
			age: 14,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: [
				{ system: 'sdif:uss', value: 'ADA0001' },
				{ system: 'sdif:uss-new', value: '031412ADAMTERN' }
			]
		});
		expect(meet.swimmers[1]?.externalIds).toEqual([]);
	});

	test('reads events, keyed by number, with alphanumeric numbers kept', () => {
		expect(meet.events).toEqual([
			{
				id: '1',
				number: '1',
				type: 'individual',
				gender: 'F',
				sexCode: 'F',
				distance: 100,
				stroke: 'FREE',
				course: 'SCM',
				ageBand: { min: 13, max: 14 },
				date: '2026-10-03'
			},
			expect.objectContaining({ id: '3', stroke: 'BACK', distance: 50 }),
			expect.objectContaining({
				id: '2A',
				number: '2A',
				gender: 'M',
				stroke: 'IM',
				ageBand: { min: 15, max: null }
			}),
			expect.objectContaining({
				id: '4',
				type: 'relay',
				stroke: 'FREE',
				distance: 200,
				gender: 'F'
			})
		]);
	});

	test('reads every round of an individual swim, with splits', () => {
		expect(meet.entries[0]).toEqual({
			kind: 'individual',
			eventId: '1',
			swimmerId: 'tern|ada|2012-03-14',
			teamCode: 'BCHSC',
			seedTime: { kind: 'time', hundredths: 6532 },
			seedCourse: 'SCM',
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
					lane: 3,
					points: 17,
					splits: [3012, 6355],
					splitDistance: 50
				}
			]
		});
	});

	test('reads a DQ and an NT seed', () => {
		expect(meet.entries[1]).toMatchObject({
			eventId: '3',
			results: [{ round: 'final', time: { kind: 'dq' }, status: 'dq', heat: 2, lane: 5 }]
		});
		expect(meet.entries[2]).toMatchObject({
			eventId: '2A',
			swimmerId: 'petrel|ben|2010-07-02',
			seedTime: { kind: 'nt' }
		});
	});

	test('reads relays with legs and an alternate', () => {
		const relay = meet.entries.find((e) => e.kind === 'relay');
		expect(relay).toMatchObject({
			kind: 'relay',
			eventId: '4',
			teamCode: 'BCHSC',
			relayLetter: 'A',
			seedTime: { kind: 'time', hundredths: 13000 },
			results: [{ round: 'final', time: { kind: 'time', hundredths: 12550 }, place: 1 }]
		});
		expect(relay?.kind === 'relay' && relay.legs).toEqual([
			{
				swimmerId: 'tern|ada|2012-03-14',
				name: 'Tern, Ada M',
				order: 1,
				legTime: { kind: 'time', hundredths: 3140 }
			},
			{ swimmerId: 'gannet|cleo|2012-11-30', name: 'Gannet, Cleo', order: 2 },
			{ swimmerId: 'skua|dana|2013-01-05', name: 'Skua, Dana', order: 3 },
			{ swimmerId: 'auk|emma|2012-06-21', name: 'Auk, Emma', order: 4 },
			{ swimmerId: 'loon|fay|2013-09-09', name: 'Loon, Fay', order: 'alternate' }
		]);
	});

	test('attaches a swimmer to the team of the preceding C1', () => {
		const gil = meet.swimmers.find((s) => s.lastName === 'Murre');
		expect(gil?.teamCode).toBe('BCOCN');
		expect(meet.entries.at(-1)).toMatchObject({ teamCode: 'BCOCN', seedCourse: 'SCY' });
	});

	test('keeps every line as a raw record', () => {
		expect(result.records).toHaveLength(24);
		expect(result.records[0]).toMatchObject({ code: 'A0', line: 1 });
		expect(result.records[0]?.text).toHaveLength(160);
		expect(result.warnings).toEqual([]);
	});
});

describe('readSdif on a Team Unify-style entries file', () => {
	const { meet } = readSdif(fixture('entries-tu.sd3'));

	test('reads entries with right-justified NT and padded event numbers', () => {
		expect(meet.events.map((e) => e.number)).toEqual(['12', '3', '14']);
		expect(meet.entries.map((e) => e.kind === 'individual' && e.seedTime)).toEqual([
			{ kind: 'time', hundredths: 6532 },
			{ kind: 'nt' },
			{ kind: 'time', hundredths: 29000 }
		]);
		expect(meet.entries.every((e) => e.results.length === 0)).toBe(true);
	});

	test('keeps the member id a club export places in the USS# field', () => {
		expect(meet.swimmers[0]?.externalIds).toEqual([
			{ system: 'sdif:uss', value: '123456789' },
			{ system: 'sdif:uss-new', value: '123456789' }
		]);
		expect(meet.swimmers).toHaveLength(2);
	});

	test('treats a blank date as missing and an age band open below', () => {
		expect(meet.events[1]?.ageBand).toEqual({ min: null, max: 14 });
		expect(meet.events[0]?.date).toBeUndefined();
	});
});

describe('readSdif on a CL2 file', () => {
	const result = readSdif(fixture('results.cl2'));

	test('reads 161-character records and numeric course codes', () => {
		const [entry] = result.meet.entries;
		expect(entry).toMatchObject({
			eventId: '7',
			results: [
				{ round: 'prelim', time: { kind: 'time', hundredths: 6720 }, splits: [3240, 6720] },
				{ round: 'final', time: { kind: 'time', hundredths: 6690 }, splits: [3200, 6690] }
			]
		});
		expect(result.meet.course).toBe('LCM');
	});

	test('reads a mixed medley relay', () => {
		const event = result.meet.events.find((e) => e.type === 'relay');
		expect(event).toMatchObject({
			gender: 'X',
			sexCode: 'X',
			stroke: 'MEDLEY',
			ageBand: { min: null, max: null }
		});
		const relay = result.meet.entries.find((e) => e.kind === 'relay');
		expect(relay?.kind === 'relay' && relay.legs.map((l) => l.order)).toEqual([1, 2, 3, 4]);
	});
});

describe('readSdif robustness', () => {
	test('accepts plain text and LF line endings', () => {
		const text = new TextDecoder('latin1').decode(fixture('entries-tu.sd3')).replace(/\r\n/g, '\n');
		expect(readSdif(text).meet.entries).toHaveLength(3);
	});

	test('warns about a D0 before any team and skips it', () => {
		const d0 = 'D01        Orphan, Olive'.padEnd(160);
		const result = readSdif(`${d0}\r\n`);
		expect(result.meet.entries).toEqual([]);
		expect(result.warnings).toEqual(['line 1: D0 before any C1 team record; skipped']);
	});

	test('warns about an unknown stroke code instead of guessing', () => {
		const c1 = 'C11        BCHSC Harbour Swim Club'.padEnd(160);
		const d0 = 'D01        Tern, Ada'.padEnd(65) + 'FF 1009   11314';
		const result = readSdif(`${c1}\r\n${d0.padEnd(160)}\r\n`);
		expect(result.warnings).toEqual(['line 2: unknown stroke code "9"; skipped']);
	});
});
