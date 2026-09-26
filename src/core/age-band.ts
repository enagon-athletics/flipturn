// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import type { AgeBand } from './types.js';

const OPEN_LOW: ReadonlySet<string> = new Set(['', 'UN', '0', '00']);
const OPEN_HIGH: ReadonlySet<string> = new Set(['', 'OV', '109']);

function bound(raw: string, open: ReadonlySet<string>): number | null {
	const value = raw.trim().toUpperCase();
	if (open.has(value)) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

/** Reads an age range from its two halves (`UN`/`10`, `15`/`OV`, Hy-Tek `0`/`109`). */
export function parseAgeCode(lower: string, upper: string): AgeBand {
	return { min: bound(lower, OPEN_LOW), max: bound(upper, OPEN_HIGH) };
}

export function ageBandLabel(band: AgeBand): string {
	const { min, max } = band;
	if (min === null && max === null) return 'Open';
	if (min === null) return `${max} & Under`;
	if (max === null) return `${min} & Over`;
	return min === max ? `${min}` : `${min}-${max}`;
}
