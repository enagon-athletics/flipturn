import { describe, expect, test } from 'bun:test';
import {
	EventFileReadError,
	FlipturnError,
	Hy3ReadError,
	SdifReadError,
	SdifWriteError,
	ZipReadError
} from '../../src/core/index.js';

describe('FlipturnError hierarchy', () => {
	test('every subclass is a FlipturnError with its format code and name', () => {
		const cases: [FlipturnError, string, string][] = [
			[new SdifReadError('bad'), 'sdif-read', 'SdifReadError'],
			[new Hy3ReadError('bad'), 'hy3-read', 'Hy3ReadError'],
			[new EventFileReadError('bad'), 'event-file-read', 'EventFileReadError'],
			[new ZipReadError('bad'), 'zip-read', 'ZipReadError']
		];
		for (const [error, code, name] of cases) {
			expect(error).toBeInstanceOf(FlipturnError);
			expect(error).toBeInstanceOf(Error);
			expect(error.code).toBe(code);
			expect(error.name).toBe(name);
		}
	});

	test('SdifWriteError carries its issues and a sdif-write code', () => {
		const error = new SdifWriteError(['a', 'b']);
		expect(error).toBeInstanceOf(FlipturnError);
		expect(error.code).toBe('sdif-write');
		expect(error.issues).toEqual(['a', 'b']);
		expect(error.message).toBe('SDIF entries file is invalid: a; b');
	});
});
