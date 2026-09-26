import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const PUBLIC_ENTRIES = [
	'index.ts',
	'core/index.ts',
	'ev3/index.ts',
	'hy3/index.ts',
	'hyv/index.ts',
	'sdif/index.ts',
	'zip/index.ts'
];

const EXPORT_FROM = /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s*from\s*['"](\.[^'"]+)['"]/g;

/** Follows every relative `export ... from` specifier, recording each file it reaches. */
function collect(file: string, visited: Set<string>): void {
	if (visited.has(file)) return;
	visited.add(file);
	const source = readFileSync(file, 'utf8');
	for (const match of source.matchAll(EXPORT_FROM)) {
		const specifier = (match[1] ?? '').replace(/\.js$/, '.ts');
		collect(resolve(dirname(file), specifier), visited);
	}
}

describe('public API boundary', () => {
	test('no public entry point re-exports from src/internal', () => {
		const visited = new Set<string>();
		for (const entry of PUBLIC_ENTRIES) collect(resolve(SRC, entry), visited);
		const leaks = [...visited].filter((file) => file.includes(`${sep}internal${sep}`));
		expect(leaks).toEqual([]);
	});
});
