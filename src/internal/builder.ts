// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import type { ExternalId, Meet, MeetEvent, Swimmer, Team } from '../core/types.js';

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface ParsedName {
	readonly last: string;
	readonly first: string;
	readonly middle?: string;
}

/** Splits `Last, First M` (the SDIF NAME form); a trailing single letter is the middle initial. */
export function splitName(full: string): ParsedName {
	const [lastPart = '', ...rest] = full.split(',');
	const tokens = rest.join(',').trim().split(/\s+/).filter(Boolean);
	const last = lastPart.trim();
	if (tokens.length >= 2 && /^[A-Za-z]\.?$/.test(tokens.at(-1) ?? '')) {
		const middle = (tokens.pop() ?? '').replace('.', '');
		return { last, first: tokens.join(' '), middle };
	}
	return { last, first: tokens.join(' ') };
}

type SwimmerDraft = Mutable<Omit<Swimmer, 'externalIds'>> & { externalIds: ExternalId[] };

/** Registry keyed on last name, first name and birth date: the strongest identity a file offers. */
export class SwimmerRegistry {
	private readonly byKey = new Map<string, SwimmerDraft>();

	upsert(name: ParsedName, fields: Partial<Omit<Swimmer, 'id' | 'externalIds'>>): SwimmerDraft {
		const key = `${name.last}|${name.first}|${fields.birthDate ?? ''}`.toLowerCase();
		let draft = this.byKey.get(key);
		if (!draft) {
			draft = { id: key, lastName: name.last, firstName: name.first, externalIds: [] };
			if (name.middle) draft.middleInitial = name.middle;
			this.byKey.set(key, draft);
		}
		for (const [field, value] of Object.entries(fields)) {
			const target = draft as unknown as Record<string, unknown>;
			if (value !== undefined && target[field] === undefined) target[field] = value;
		}
		return draft;
	}

	addId(draft: SwimmerDraft, id: ExternalId | undefined): void {
		if (!id || !id.value) return;
		const seen = draft.externalIds.some((e) => e.system === id.system && e.value === id.value);
		if (!seen) draft.externalIds.push(id);
	}

	list(): Swimmer[] {
		return [...this.byKey.values()];
	}
}

export function emptyMeet(): Mutable<Meet> & {
	teams: Team[];
	events: MeetEvent[];
} {
	return { name: '', teams: [], swimmers: [], events: [], entries: [], sessions: [] };
}

/** Drops keys whose value is undefined so models compare cleanly. */
export function compact<T extends object>(value: T): T {
	return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** `value` with undefined fields dropped, or `undefined` if nothing is left. */
export function nonEmpty<T extends object>(value: T): T | undefined {
	const kept = compact(value);
	return Object.keys(kept).length > 0 ? kept : undefined;
}

/** An address object, or undefined when every part is blank. */
export function address<T extends Record<string, string | undefined>>(parts: T): T | undefined {
	const kept = compact(
		Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v ? v : undefined]))
	) as T;
	return Object.keys(kept).length > 0 ? kept : undefined;
}

export function intOrUndefined(raw: string): number | undefined {
	const value = Number.parseInt(raw.trim(), 10);
	return Number.isNaN(value) || value === 0 ? undefined : value;
}

export function numberOrUndefined(raw: string): number | undefined {
	const value = Number.parseFloat(raw.trim());
	return Number.isNaN(value) ? undefined : value;
}

export function splitLines(text: string): string[] {
	const lines = text.split(/\r?\n/);
	if (lines.at(-1) === '') lines.pop();
	return lines;
}
