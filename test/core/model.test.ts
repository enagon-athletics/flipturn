import { describe, expect, test } from 'bun:test';
import {
	ageBandLabel,
	decodeWindows1252,
	encodeWindows1252,
	eventKey,
	genderFromSexCode,
	isoFromMmddyyyy,
	mmddyyyyFromIso,
	parseAgeCode,
	toText
} from '../../src/core/index.js';

describe('parseAgeCode', () => {
	test('reads bounded, under and over bands', () => {
		expect(parseAgeCode('11', '12')).toEqual({ min: 11, max: 12 });
		expect(parseAgeCode('UN', '10')).toEqual({ min: null, max: 10 });
		expect(parseAgeCode('15', 'OV')).toEqual({ min: 15, max: null });
		expect(parseAgeCode('UN', 'OV')).toEqual({ min: null, max: null });
	});

	test('treats Hy-Tek open markers 0 and 109 as unbounded', () => {
		expect(parseAgeCode('0', '8')).toEqual({ min: null, max: 8 });
		expect(parseAgeCode('15', '109')).toEqual({ min: 15, max: null });
		expect(parseAgeCode('', '')).toEqual({ min: null, max: null });
	});
});

describe('ageBandLabel', () => {
	test('labels each band shape', () => {
		expect(ageBandLabel({ min: 11, max: 12 })).toBe('11-12');
		expect(ageBandLabel({ min: 9, max: 9 })).toBe('9');
		expect(ageBandLabel({ min: null, max: 10 })).toBe('10 & Under');
		expect(ageBandLabel({ min: 15, max: null })).toBe('15 & Over');
		expect(ageBandLabel({ min: null, max: null })).toBe('Open');
	});
});

describe('genderFromSexCode', () => {
	test('maps age-group and senior codes onto a canonical gender', () => {
		expect(genderFromSexCode('G')).toBe('F');
		expect(genderFromSexCode('W')).toBe('F');
		expect(genderFromSexCode('F')).toBe('F');
		expect(genderFromSexCode('B')).toBe('M');
		expect(genderFromSexCode('M')).toBe('M');
		expect(genderFromSexCode('X')).toBe('X');
	});

	test('returns undefined for an unknown code', () => {
		expect(genderFromSexCode('P')).toBeUndefined();
	});
});

describe('eventKey', () => {
	test('builds a stable identity from what an event is', () => {
		expect(
			eventKey({
				type: 'individual',
				gender: 'F',
				ageBand: { min: 13, max: 14 },
				distance: 50,
				stroke: 'FREE',
				course: 'SCY'
			})
		).toBe('individual:F:13-14:50:FREE:SCY');
		expect(
			eventKey({
				type: 'relay',
				gender: 'X',
				ageBand: { min: null, max: null },
				distance: 200,
				stroke: 'MEDLEY'
			})
		).toBe('relay:X:UN-OV:200:MEDLEY:?');
	});
});

describe('dates', () => {
	test('converts MMDDYYYY to ISO and back', () => {
		expect(isoFromMmddyyyy('03142009')).toBe('2009-03-14');
		expect(mmddyyyyFromIso('2009-03-14')).toBe('03142009');
	});

	test('treats blank or zeroed dates as missing', () => {
		expect(isoFromMmddyyyy('        ')).toBeUndefined();
		expect(isoFromMmddyyyy('00000000')).toBeUndefined();
	});

	test('rejects malformed ISO input', () => {
		expect(() => mmddyyyyFromIso('2009/03/14')).toThrow('Invalid ISO date');
	});
});

describe('Windows-1252 text', () => {
	test('round-trips Latin-1 and the 0x80-0x9F block', () => {
		const text = 'Beaulé – Œuvre €5';
		const bytes = encodeWindows1252(text);
		expect(bytes.length).toBe(text.length);
		expect(decodeWindows1252(bytes)).toBe(text);
	});

	test('throws on a character outside Windows-1252', () => {
		expect(() => encodeWindows1252('名')).toThrow('not representable in Windows-1252');
	});

	test('toText passes strings through and decodes bytes', () => {
		expect(toText('abc')).toBe('abc');
		expect(toText(new Uint8Array([0x41, 0xe9]))).toBe('Aé');
	});

	test('toText honours a UTF-8 byte-order mark', () => {
		expect(toText(new Uint8Array([0xef, 0xbb, 0xbf, 0xc3, 0xa9]))).toBe('é');
	});
});
