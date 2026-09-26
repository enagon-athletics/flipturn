// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import { parseAgeCode } from '../core/age-band.js';
import { eventKey, genderFromSexCode, isSexCode } from '../core/codes.js';
import { isoFromMmddyyyy } from '../core/dates.js';
import { parseSwimTime, type SwimTime } from '../core/swim-time.js';
import type {
	Course,
	EventType,
	MeetEvent,
	QualifyingTimes,
	RawRecord,
	Session,
	SexCode,
	Stroke
} from '../core/types.js';
import { compact, splitLines } from './builder.js';

export const clean = (value: string | undefined): string => (value ?? '').trim();

const EPOCH_SENTINEL = /^(01\/01\/1970|12\/30\/1899)$/;
const PLACEHOLDER_CUT_HUNDREDTHS = 100;

export function setupDate(raw: string | undefined, dropSentinels = false): string | undefined {
	const value = clean(raw);
	if (dropSentinels && EPOCH_SENTINEL.test(value)) return undefined;
	return isoFromMmddyyyy(value.replace(/\//g, ''));
}

/** `05:00PM` to 24-hour `17:00`. */
export function clockTime(raw: string | undefined): string | undefined {
	const match = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec(clean(raw));
	if (!match) return undefined;
	const [, hour = '0', minute = '00', half = 'A'] = match;
	const hours = (Number.parseInt(hour, 10) % 12) + (half.toUpperCase() === 'P' ? 12 : 0);
	return `${String(hours).padStart(2, '0')}:${minute}`;
}

export function intOrNone(raw: string | undefined): number | undefined {
	const value = Number.parseInt(clean(raw), 10);
	return Number.isNaN(value) ? undefined : value;
}

export function cut(raw: string | undefined, dropPlaceholders: boolean): SwimTime | undefined {
	const value = clean(raw);
	if (!value) return undefined;
	try {
		const time = parseSwimTime(value);
		if (dropPlaceholders && time.kind === 'time' && time.hundredths <= PLACEHOLDER_CUT_HUNDREDTHS) {
			return undefined;
		}
		return time;
	} catch {
		return undefined;
	}
}

export function qualifying(times: Partial<Record<Course, SwimTime>>): QualifyingTimes | undefined {
	const kept = compact(times);
	return Object.keys(kept).length > 0 ? kept : undefined;
}

export function eventSex(raw: string | undefined, number: string): SexCode {
	const code = clean(raw);
	if (!isSexCode(code)) throw new Error(`unknown event sex code "${code}" on event ${number}`);
	return code;
}

export interface SetupEventParts {
	readonly number: string;
	readonly type: EventType;
	readonly sexCode: SexCode;
	readonly distance: number;
	readonly stroke: Stroke;
	readonly course?: Course;
	readonly lower: string;
	readonly upper: string;
	readonly extra: Partial<MeetEvent>;
}

export function setupEvent(parts: SetupEventParts): MeetEvent {
	const base = {
		type: parts.type,
		gender: genderFromSexCode(parts.sexCode) ?? 'X',
		sexCode: parts.sexCode,
		distance: parts.distance,
		stroke: parts.stroke,
		course: parts.course,
		ageBand: parseAgeCode(parts.lower, parts.upper)
	};
	return compact({
		id: parts.number || `u:${eventKey(base)}`,
		number: parts.number,
		...base,
		...parts.extra
	});
}

export function deriveSessions(
	events: readonly MeetEvent[],
	stamps: ReadonlyMap<string, { day?: number; startTime?: string }>
): Session[] {
	const sessions = new Map<string, Session>();
	for (const event of events) {
		if (!event.sessionId) continue;
		const existing = sessions.get(event.sessionId);
		const stamp = stamps.get(event.sessionId) ?? {};
		sessions.set(
			event.sessionId,
			compact({
				id: event.sessionId,
				day: stamp.day,
				startTime: stamp.startTime,
				eventCount: (existing?.eventCount ?? 0) + 1
			})
		);
	}
	return [...sessions.values()];
}

export interface SplitRecords {
	readonly head: string[];
	readonly rows: { fields: string[]; line: number }[];
	readonly records: RawRecord[];
}

/** Splits a semicolon-delimited setup file, dropping the ev3 `*>` terminator. */
export function splitSetup(text: string, format: string): SplitRecords {
	const records: RawRecord[] = [];
	const parsed: { fields: string[]; line: number }[] = [];
	splitLines(text).forEach((line, index) => {
		if (!line.trim()) return;
		records.push({ code: parsed.length === 0 ? 'header' : 'event', line: index + 1, text: line });
		parsed.push({ fields: line.replace(/\*>\s*$/, '').split(';'), line: index + 1 });
	});
	const [head, ...rows] = parsed;
	if (!head) throw new Error(`empty .${format} file`);
	return { head: head.fields, rows, records };
}
