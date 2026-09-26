// Ported from https://github.com/dmanusrex/swimlib @ c3dd473 (MIT); field layouts are from the SDIF v3 spec.
import type { SwimTime } from '../core/swim-time.js';

export const RECORD_LENGTH = 160;

export interface FieldSpec {
	/** 1-based column, as the spec numbers them. */
	readonly start: number;
	readonly length: number;
	/** INT and DEC fields are right-justified; `numeric` right-justifies all-digit ALPHA values. */
	readonly align?: 'right' | 'numeric';
	/** Free text that may be cut to fit; anything else that overflows is an error. */
	readonly truncate?: boolean;
}

export type Layout = Readonly<Record<string, FieldSpec>>;

export type FieldValues<L extends Layout> = Partial<Record<keyof L, string | number | undefined>>;

export function formatRecord<L extends Layout>(
	code: string,
	layout: L,
	values: FieldValues<L>,
	onTruncate: (value: string, length: number) => void
): string {
	const record = Array.from<string>({ length: RECORD_LENGTH }).fill(' ');
	record[0] = code.charAt(0);
	record[1] = code.charAt(1);
	for (const [name, spec] of Object.entries(layout)) {
		const raw = values[name];
		if (raw === undefined || raw === '') continue;
		let text = String(raw);
		if (text.length > spec.length) {
			if (!spec.truncate) {
				throw new Error(`${code} ${name} "${text}" does not fit in ${spec.length} characters`);
			}
			onTruncate(text, spec.length);
			text = text.slice(0, spec.length);
		}
		const right = spec.align === 'right' || (spec.align === 'numeric' && /^\d+$/.test(text));
		const padded = right ? text.padStart(spec.length) : text.padEnd(spec.length);
		record.splice(spec.start - 1, spec.length, ...padded);
	}
	return record.join('');
}

/** An 8-byte SDIF TIME: `mm:ss.ss` right-justified, or a TIME code left-justified. */
export function formatSdifTime(time: SwimTime): string {
	if (time.kind !== 'time') return time.kind.toUpperCase().padEnd(8);
	const minutes = Math.floor(time.hundredths / 6000);
	if (minutes >= 100)
		throw new Error(`${time.hundredths} hundredths is too long for an SDIF time field`);
	const seconds = Math.floor((time.hundredths % 6000) / 100);
	const fraction = String(time.hundredths % 100).padStart(2, '0');
	const text =
		minutes > 0
			? `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`
			: `${seconds}.${fraction}`;
	return text.padStart(8);
}
