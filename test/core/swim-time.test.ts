import { describe, expect, test } from 'bun:test';
import {
	formatSwimTime,
	parseSwimTime,
	swimTimeFromSeconds,
	type SwimTime
} from '../../src/core/swim-time.js';

describe('parseSwimTime', () => {
	test('parses minutes:seconds.hundredths', () => {
		expect(parseSwimTime('1:02.34')).toEqual({ kind: 'time', hundredths: 6234 });
	});

	test('parses seconds-only times', () => {
		expect(parseSwimTime('58.12')).toEqual({ kind: 'time', hundredths: 5812 });
	});

	test('parses zero-padded minutes', () => {
		expect(parseSwimTime('01:10.96')).toEqual({ kind: 'time', hundredths: 7096 });
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

	test('rejects seconds of 60 or more when minutes are given', () => {
		expect(() => parseSwimTime('1:60.00')).toThrow('Invalid swim time');
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

describe('swimTimeFromSeconds', () => {
	test('reads raw seconds, including values over a minute', () => {
		expect(swimTimeFromSeconds('138.08')).toEqual({ kind: 'time', hundredths: 13808 });
		expect(swimTimeFromSeconds(' 73.46')).toEqual({ kind: 'time', hundredths: 7346 });
	});

	test('returns null for blank, zero or non-numeric input', () => {
		expect(swimTimeFromSeconds('')).toBeNull();
		expect(swimTimeFromSeconds('0.00')).toBeNull();
		expect(swimTimeFromSeconds('abc')).toBeNull();
	});
});

// Deterministic LCG so a failure reproduces.
function* samples(count: number, max: number): Generator<number> {
	let seed = 20260926;
	for (let i = 0; i < count; i++) {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		yield seed % max;
	}
}

describe('SwimTime properties', () => {
	const MAX = 100 * 60 * 100;

	test('format then parse is the identity for any time under 100 minutes', () => {
		for (const hundredths of samples(5000, MAX)) {
			const time: SwimTime = { kind: 'time', hundredths };
			expect(parseSwimTime(formatSwimTime(time))).toEqual(time);
		}
	});

	test('formatted times order the same way as their hundredths', () => {
		const values = [...samples(500, 6000)].sort((a, b) => a - b);
		const formatted = values.map((h) => formatSwimTime({ kind: 'time', hundredths: h }));
		const reparsed = formatted.map((f) => (parseSwimTime(f) as { hundredths: number }).hundredths);
		expect(reparsed).toEqual(values);
	});

	test('seconds and display forms agree', () => {
		for (const hundredths of samples(2000, MAX)) {
			if (hundredths === 0) continue;
			const seconds = (hundredths / 100).toFixed(2);
			expect(swimTimeFromSeconds(seconds)).toEqual({ kind: 'time', hundredths });
		}
	});
});
