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

describe('formatSdifTime', () => {
	test('follows the spec mm:ss.ss layout', () => {
		expect(formatSdifTime({ kind: 'time', hundredths: 6532 })).toBe(' 1:05.32');
		expect(formatSdifTime({ kind: 'time', hundredths: 5812 })).toBe('   58.12');
		expect(formatSdifTime({ kind: 'time', hundredths: 532 })).toBe('    5.32');
		expect(formatSdifTime({ kind: 'time', hundredths: 60532 })).toBe('10:05.32');
		expect(formatSdifTime({ kind: 'nt' })).toBe('NT      ');
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
