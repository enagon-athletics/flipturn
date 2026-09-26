// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import type { FormatName } from '../core/types.js';

const EXTENSIONS: Readonly<Record<string, FormatName>> = {
	hy3: 'hy3',
	sd3: 'sdif',
	cl2: 'sdif',
	ev3: 'ev3',
	hyv: 'hyv'
};

/** Sniffs a meet file's format from its first lines, using the file name only as a tie-breaker. */
export function detectFormat(content: string, filename?: string): FormatName | null {
	const firstLines = content.split(/\r?\n/, 5);
	for (const line of firstLines) {
		const code = line.slice(0, 2);
		if (code === 'A1') return 'hy3';
		if (code === 'A0' || code === 'B1') return 'sdif';
	}
	if (firstLines.some((l) => /^(D0|D3)/.test(l))) return 'sdif';
	if (firstLines.some((l) => /^(D1|E1)/.test(l))) return 'hy3';

	const delimited = firstLines.filter((l) => l.split(';').length >= 10);
	if (delimited.length >= 2) {
		return delimited.some((l) => l.trimEnd().endsWith('*>')) ? 'ev3' : 'hyv';
	}

	const extension = filename?.toLowerCase().split('.').pop() ?? '';
	return EXTENSIONS[extension] ?? null;
}
