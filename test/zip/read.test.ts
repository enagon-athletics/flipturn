import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { detectFormat, readMeetArchive, readMeetFiles, unzip } from '../../src/zip/index.js';

const load = (path: string) =>
	new Uint8Array(readFileSync(new URL(`../fixtures/${path}`, import.meta.url)));

describe('unzip', () => {
	test('inflates deflated entries and keeps stored ones', async () => {
		const entries = await unzip(load('zip/results.zip'));
		expect(entries.map((e) => [e.name, e.bytes.length])).toEqual([
			['Results.cl2', 1956],
			['Results.hy3', 2376],
			['readme.txt', 39]
		]);
		expect(entries[0]?.bytes).toEqual(load('sdif/results.cl2'));
	});

	test('reads a stored-only archive', async () => {
		const entries = await unzip(load('zip/events.zip'));
		expect(entries.map((e) => e.name)).toEqual(['Meet.ev3', 'Meet.hyv']);
		expect(entries[1]?.bytes).toEqual(load('hyv/meet.hyv'));
	});

	test('rejects bytes that are not a zip archive', async () => {
		await expect(unzip(load('sdif/results.sd3'))).rejects.toThrow('Not a zip archive');
	});

	test('rejects an entry whose CRC does not match', async () => {
		const bytes = load('zip/events.zip');
		const at = bytes.indexOf(0x3b);
		bytes[at] = 0x3a;
		await expect(unzip(bytes)).rejects.toThrow('CRC mismatch in Meet.ev3');
	});

	test('refuses entries over the size limit', async () => {
		await expect(unzip(load('zip/results.zip'), { maxEntryBytes: 1000 })).rejects.toThrow(
			'Results.cl2 is larger than 1000 bytes'
		);
	});
});

describe('detectFormat', () => {
	const text = (path: string) => new TextDecoder('latin1').decode(load(path));

	test('sniffs content first', () => {
		expect(detectFormat(text('sdif/results.sd3'))).toBe('sdif');
		expect(detectFormat(text('sdif/results.cl2'))).toBe('sdif');
		expect(detectFormat(text('hy3/results.hy3'))).toBe('hy3');
		expect(detectFormat(text('ev3/meet.ev3'))).toBe('ev3');
		expect(detectFormat(text('hyv/meet.hyv'))).toBe('hyv');
	});

	test('falls back to the extension, and gives up otherwise', () => {
		expect(detectFormat('', 'Meet.HY3')).toBe('hy3');
		expect(detectFormat('', 'entries.sd3')).toBe('sdif');
		expect(detectFormat('hello', 'notes.txt')).toBeNull();
	});
});

describe('readMeetArchive', () => {
	test('dispatches each inner file to its reader', async () => {
		const files = await readMeetArchive(load('zip/results.zip'));
		expect(files.map((f) => [f.name, f.format])).toEqual([
			['Results.cl2', 'sdif'],
			['Results.hy3', 'hy3'],
			['readme.txt', null]
		]);
		expect(files[1]?.result?.meet.entries).toHaveLength(4);
	});

	test('reports a reader error against its file instead of failing the archive', () => {
		const bad = new TextEncoder().encode(
			'Name;10/17/2026;10/18/2026;;S;Host;;SW;1.0\r\n1;F;P;I;0;10;50;1\r\n'
		);
		const [file] = readMeetFiles([{ name: 'bad.hyv', bytes: bad }]);
		expect(file).toEqual({
			name: 'bad.hyv',
			format: 'hyv',
			error: 'unknown event sex code "P" on event 1'
		});
	});
});
