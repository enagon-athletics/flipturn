import { describe, expect, test } from 'bun:test';
import { formatSwimTime, parseSwimTime } from '../../src/core/swim-time.js';

describe('parseSwimTime', () => {
	test('parses minutes:seconds.hundredths', () => {
		expect(parseSwimTime('1:02.34')).toEqual({ kind: 'time', hundredths: 6234 });
	});

	test('parses seconds-only times', () => {
		expect(parseSwimTime('58.12')).toEqual({ kind: 'time', hundredths: 5812 });
	});

	test('pads a single fractional digit', () => {
		expect(parseSwimTime('1:02.3')).toEqual({ kind: 'time', hundredths: 6230 });
	});

	test('parses NT case-insensitively and trims whitespace', () => {
		expect(parseSwimTime('  nt  ')).toEqual({ kind: 'nt' });
	});

	test('parses NS', () => {
		expect(parseSwimTime('NS')).toEqual({ kind: 'ns' });
	});

	test('parses DQ', () => {
		expect(parseSwimTime('DQ')).toEqual({ kind: 'dq' });
	});

	test('throws on an unparseable string', () => {
		expect(() => parseSwimTime('not-a-time')).toThrow('Invalid swim time: "not-a-time"');
	});
});

describe('formatSwimTime', () => {
	test('formats minutes and seconds', () => {
		expect(formatSwimTime({ kind: 'time', hundredths: 6234 })).toBe('1:02.34');
	});

	test('formats sub-minute times without a minutes segment', () => {
		expect(formatSwimTime({ kind: 'time', hundredths: 5812 })).toBe('58.12');
	});

	test('formats NT, NS, DQ', () => {
		expect(formatSwimTime({ kind: 'nt' })).toBe('NT');
		expect(formatSwimTime({ kind: 'ns' })).toBe('NS');
		expect(formatSwimTime({ kind: 'dq' })).toBe('DQ');
	});

	test('round-trips through parse and format', () => {
		for (const input of ['1:02.34', '58.12', 'NT', 'NS', 'DQ']) {
			expect(formatSwimTime(parseSwimTime(input))).toBe(input);
		}
	});
});
