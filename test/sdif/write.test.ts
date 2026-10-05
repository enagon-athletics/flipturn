import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { Meet } from '../../src/core/index.js';
import { formatSdifTime } from '../../src/sdif/fixed-width.js';
import {
	readSdif,
	SdifWriteError,
	writeSdifEntries,
	type SdifWriteOptions
} from '../../src/sdif/index.js';
import { entriesMeet } from './entries-meet.js';

const options: SdifWriteOptions = {
	mode: 'canadian',
	contact: { name: 'Registrar, Lee', phone: '2505550199' },
	createdAt: '2026-09-20',
	software: { name: 'flipturn', version: 'test' }
};

const golden = readFileSync(new URL('../fixtures/sdif/entries-golden.sd3', import.meta.url));

describe('writeSdifEntries', () => {
	const { text, warnings } = writeSdifEntries(entriesMeet, options);
	const lines = text.split('\r\n');

	test('matches the golden file byte for byte', () => {
		expect(Buffer.from(text, 'latin1').equals(golden)).toBe(true);
		expect(warnings).toEqual([]);
	});

	test('writes 160-character records, each ended by CRLF', () => {
		expect(text.endsWith('\r\n')).toBe(true);
		expect(lines.pop()).toBe('');
		for (const line of lines) expect(line).toHaveLength(160);
	});

	test('orders records as the spec meet-entry pyramid', () => {
		expect(lines.map((l) => l.slice(0, 2))).toEqual([
			'A0',
			'B1',
			'B2',
			'C1',
			'C2',
			'D0',
			'D3',
			'D0',
			'D0',
			'D3',
			'D0',
			'D3',
			'D0',
			'D3',
			'D0',
			'D3',
			'D0',
			'D3',
			'E0',
			'F0',
			'F0',
			'F0',
			'F0',
			'F0',
			'Z0'
		]);
	});

	test('counts records in the terminator', () => {
		const z0 = lines.at(-1) ?? '';
		expect(z0.slice(11, 13)).toBe('01');
		expect(z0.slice(43, 86)).toBe('  2  1   2   1    13     6    1     5     0');
	});

	test('round-trips through the reader to the same meet', () => {
		const read = readSdif(text);
		expect(read.meet).toEqual(entriesMeet);
		expect(read.warnings).toEqual([]);
		expect(read.source).toEqual({ software: 'flipturn', version: 'test', createdAt: '2026-09-20' });
	});
});

describe('writeSdifEntries modes and validation', () => {
	test('standard mode requires a USS# for every swimmer', () => {
		const run = () => writeSdifEntries(entriesMeet, { ...options, mode: 'standard' });
		expect(run).toThrow(SdifWriteError);
		try {
			run();
		} catch (error) {
			expect((error as SdifWriteError).issues).toEqual([
				'swimmer petrel|ben|2010-07-02 has no USS# (use canadian mode to make it optional)',
				'swimmer gannet|cleo|2012-11-30 has no USS# (use canadian mode to make it optional)',
				'swimmer skua|dana|2013-01-05 has no USS# (use canadian mode to make it optional)',
				'swimmer auk|emma|2012-06-21 has no USS# (use canadian mode to make it optional)',
				'swimmer loon|fay|2013-09-09 has no USS# (use canadian mode to make it optional)'
			]);
		}
	});

	test('standard mode is the default', () => {
		const defaults = { ...options, mode: undefined };
		expect(() => writeSdifEntries(entriesMeet, defaults)).toThrow('has no USS#');
	});

	test('writes age-group and senior sex codes as the SDIF M/F', () => {
		const meet: Meet = {
			...entriesMeet,
			events: entriesMeet.events.map((e) =>
				e.id === '12' ? { ...e, sexCode: 'G' } : e.id === '14' ? { ...e, sexCode: 'B' } : e
			)
		};
		expect(writeSdifEntries(meet, options).text).toBe(writeSdifEntries(entriesMeet, options).text);
	});

	test('collects every M1 problem before throwing', () => {
		const meet: Meet = {
			...entriesMeet,
			name: '',
			entries: [...entriesMeet.entries, { ...entriesMeet.entries[0]!, eventId: 'missing' }]
		};
		expect(() => writeSdifEntries(meet, { ...options, contact: { name: '', phone: '' } })).toThrow(
			'SDIF entries file is invalid: contact name is required; contact phone is required; meet name is required; entry references unknown event missing'
		);
	});

	test('warns about blank M2 fields and truncates an over-long name', () => {
		const long = 'Featherstonehaugh-Cholmondeley';
		const meet: Meet = {
			...entriesMeet,
			address: undefined,
			swimmers: entriesMeet.swimmers.map((s, i) =>
				i === 1 ? { ...s, lastName: long, birthDate: undefined } : s
			)
		};
		const { text, warnings } = writeSdifEntries(meet, options);
		expect(warnings).toEqual([
			'meet city is blank',
			'meet state is blank',
			'swimmer petrel|ben|2010-07-02 has no birth date',
			`name "${long}, Ben" truncated to 28 characters`
		]);
		expect(text).toContain(`D01        ${`${long}, Ben`.slice(0, 28)}`);
	});

	test('rejects text Windows-1252 cannot carry', () => {
		const meet: Meet = { ...entriesMeet, name: 'Meet 名' };
		expect(() => writeSdifEntries(meet, options)).toThrow('not representable in Windows-1252');
		expect(() => writeSdifEntries(meet, options)).toThrow(SdifWriteError);
	});
});

const cols = (line: string, from: number, to: number) => line.slice(from - 1, to);
const recordsOf = (text: string, type: string) =>
	text.split('\r\n').filter((line) => line.startsWith(type));
const coachless: Meet = { ...entriesMeet, teams: [{ code: 'BCHSC', name: 'Harbour Swim Club' }] };
const renumbered = (numbers: Record<string, string>): Meet => ({
	...entriesMeet,
	events: entriesMeet.events.map((e) => ({ ...e, number: numbers[e.id] ?? e.number }))
});

describe('writeSdifEntries in the Team Unify Standard SD3 layout', () => {
	test('right-justifies an event number in columns 73-75 with any suffix letter in 76', () => {
		const numbered = (meet: Meet) =>
			recordsOf(writeSdifEntries(meet, options).text, 'D0')
				.filter((d0) => cols(d0, 67, 67) !== ' ')
				.map((d0) => cols(d0, 73, 76));
		expect(numbered(entriesMeet)).toEqual([' 12 ', '  3A', ' 14 ']);
		expect(numbered(renumbered({ '12': '1', '3A': '101', '14': '1234' }))).toEqual([
			'  1 ',
			'101 ',
			'1234'
		]);
		expect(numbered(renumbered({ '12': '12B', '3A': 'X1' }))).toEqual([' 12B', 'X1  ', ' 14 ']);
	});

	test('lays out relay event numbers the same way', () => {
		const [e0] = recordsOf(writeSdifEntries(entriesMeet, options).text, 'E0');
		expect(cols(e0 ?? '', 27, 30)).toBe(' 20 ');
	});

	test('right-justifies an NT seed and keeps its course', () => {
		const nt = recordsOf(writeSdifEntries(entriesMeet, options).text, 'D0')[1] ?? '';
		expect(cols(nt, 89, 97)).toBe('      NTS');
		const yards = { ...entriesMeet.entries[1]!, seedCourse: 'SCY' as const };
		const meet = {
			...entriesMeet,
			entries: entriesMeet.entries.map((e, i) => (i === 1 ? yards : e))
		};
		expect(cols(recordsOf(writeSdifEntries(meet, options).text, 'D0')[1] ?? '', 89, 97)).toBe(
			'      NTY'
		);
	});

	test('writes no C2 for a team without a coach and counts one C record per team', () => {
		const { text, warnings } = writeSdifEntries(coachless, options);
		expect(recordsOf(text, 'C2')).toEqual([]);
		expect(cols(recordsOf(text, 'Z0')[0] ?? '', 50, 53)).toBe('   1');
		expect(warnings).toEqual([]);
		expect(readSdif(text).meet.entries).toEqual(entriesMeet.entries);
	});

	test('writes the pool altitude in B1 columns 138-141 and reads it back', () => {
		const meet: Meet = { ...entriesMeet, altitude: 1200 };
		const { text } = writeSdifEntries(meet, options);
		expect(cols(recordsOf(text, 'B1')[0] ?? '', 138, 141)).toBe('1200');
		expect(readSdif(text).meet.altitude).toBe(1200);
	});
});

describe('writeSdifEntries with the team-unify profile', () => {
	const tu: SdifWriteOptions = { ...options, profile: 'team-unify' };
	const middle: Meet = {
		...entriesMeet,
		swimmers: entriesMeet.swimmers.map((s, i) => (i === 0 ? { ...s, middleName: 'Marie' } : s))
	};
	const { text } = writeSdifEntries(middle, tu);

	test('describes the file in A0 columns 14-43, overridable', () => {
		expect(cols(recordsOf(text, 'A0')[0] ?? '', 14, 43)).toBe('Meet Entries'.padEnd(30));
		const custom = writeSdifEntries(entriesMeet, { ...tu, description: 'Club Entries' }).text;
		expect(cols(recordsOf(custom, 'A0')[0] ?? '', 14, 43)).toBe('Club Entries'.padEnd(30));
	});

	test('writes altitude 0 when the meet gives none', () => {
		expect(cols(recordsOf(text, 'B1')[0] ?? '', 138, 141)).toBe('   0');
		const high = writeSdifEntries({ ...entriesMeet, altitude: 3500 }, tu).text;
		expect(cols(recordsOf(high, 'B1')[0] ?? '', 138, 141)).toBe('3500');
	});

	test("puts the team code's LSC in every D0's columns 4-11", () => {
		const d0s = recordsOf(text, 'D0');
		expect(d0s).toHaveLength(7);
		for (const d0 of d0s) expect(cols(d0, 4, 11)).toBe('BC      ');
	});

	test('fills D3 participation flags, middle name and trailer', () => {
		const [first, second] = recordsOf(text, 'D3');
		expect(cols(first ?? '', 3, 31)).toBe('123456789     Addie          ');
		expect(cols(first ?? '', 32, 46)).toBe(`  ${'F'.repeat(13)}`);
		expect(cols(first ?? '', 47, 146)).toBe('Marie'.padEnd(100));
		expect(cols(first ?? '', 147, 160)).toBe('N'.padEnd(14));
		expect(cols(second ?? '', 34, 160)).toBe(
			`${'F'.repeat(13)}${' '.repeat(100)}N${' '.repeat(13)}`
		);
	});

	test('writes batch 1 and zero membership counts in Z0 columns 87-103', () => {
		const z0 = recordsOf(text, 'Z0')[0] ?? '';
		expect(cols(z0, 87, 160)).toBe('    1  0  0  0  0'.padEnd(74));
	});

	test('round-trips through the reader to the same meet', () => {
		const read = readSdif(writeSdifEntries(entriesMeet, tu).text);
		expect(read.meet).toEqual(entriesMeet);
		expect(read.warnings).toEqual([]);
	});

	test('leaves the spec profile byte-identical to the default', () => {
		expect(writeSdifEntries(entriesMeet, { ...options, profile: 'spec' }).text).toBe(
			writeSdifEntries(entriesMeet, options).text
		);
	});
});

describe('formatSdifTime', () => {
	test('follows the spec mm:ss.ss layout', () => {
		expect(formatSdifTime({ kind: 'time', hundredths: 6532 })).toBe(' 1:05.32');
		expect(formatSdifTime({ kind: 'time', hundredths: 5812 })).toBe('   58.12');
		expect(formatSdifTime({ kind: 'time', hundredths: 532 })).toBe('    5.32');
		expect(formatSdifTime({ kind: 'time', hundredths: 60532 })).toBe('10:05.32');
		expect(formatSdifTime({ kind: 'nt' })).toBe('      NT');
	});

	test('keeps the colon at byte 3 and the period at byte 6 for any time', () => {
		let seed = 7;
		for (let i = 0; i < 3000; i++) {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			const hundredths = seed % (100 * 6000);
			const out = formatSdifTime({ kind: 'time', hundredths });
			expect(out).toHaveLength(8);
			expect(out.charAt(5)).toBe('.');
			expect([':', ' ']).toContain(out.charAt(2));
			expect(readSdifSeconds(out)).toBe(hundredths);
		}
	});

	test('rejects times of 100 minutes or more', () => {
		expect(() => formatSdifTime({ kind: 'time', hundredths: 600000 })).toThrow(
			'too long for an SDIF time field'
		);
	});
});

function readSdifSeconds(field: string): number {
	const [minutes, rest] = field.includes(':') ? field.split(':') : ['0', field];
	const [seconds = '0', hundredths = '0'] = (rest ?? '').trim().split('.');
	return Number(minutes) * 6000 + Number(seconds) * 100 + Number(hundredths);
}
