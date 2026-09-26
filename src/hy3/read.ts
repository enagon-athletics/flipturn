// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
// E1/F1 entryFee field position from https://github.com/dmanusrex/swimlib @ c3dd473 (MIT).
import { parseAgeCode } from '../core/age-band.js';
import { courseFromCode, eventKey, genderFromSexCode, isSexCode } from '../core/codes.js';
import { isoFromMmddyyyy } from '../core/dates.js';
import { Hy3ReadError } from '../core/errors.js';
import { swimTimeFromSeconds } from '../core/swim-time.js';
import { toText } from '../core/text.js';
import { numberOrUndefined } from '../internal/builder.js';
import type {
	Course,
	EventType,
	FileSource,
	IndividualEntry,
	MeetEvent,
	RawRecord,
	ReaderInput,
	ReadResult,
	RelayEntry,
	RelayLeg,
	Result,
	ResultStatus,
	Round,
	Stroke,
	Team
} from '../core/types.js';
import {
	compact,
	emptyMeet,
	intOrUndefined,
	splitLines,
	SwimmerRegistry,
	type Mutable
} from '../internal/builder.js';
import { hy3Checksum } from './checksum.js';

export interface Hy3ReadOptions {
	/** What to do when a line's checksum does not match. Defaults to `warn`. */
	readonly checksum?: 'warn' | 'error' | 'ignore';
}

const INDIVIDUAL_STROKES: Readonly<Record<string, Stroke>> = {
	A: 'FREE',
	B: 'BACK',
	C: 'BREAST',
	D: 'FLY',
	E: 'IM'
};

const RELAY_STROKES: Readonly<Record<string, Stroke>> = { A: 'FREE', E: 'MEDLEY' };

const ROUNDS: Readonly<Record<string, Round>> = { P: 'prelim', S: 'swimoff', F: 'final' };

const STATUS: Readonly<Record<string, ResultStatus>> = {
	' ': 'ok',
	'': 'ok',
	Q: 'dq',
	F: 'ns',
	R: 'scratch',
	D: 'dnf',
	S: 'exhibition'
};

const cut = (line: string, start: number, end: number): string => line.slice(start, end).trim();

interface Athlete {
	readonly swimmerId: string;
	readonly name: string;
	readonly teamCode?: string;
}

type ResultDraft = Mutable<Result>;

export function readHy3(input: ReaderInput, options: Hy3ReadOptions = {}): ReadResult<'hy3'> {
	const lines = splitLines(toText(input));
	const checksumMode = options.checksum ?? 'warn';
	const meet = emptyMeet();
	const source: Mutable<FileSource> = {};
	const records: RawRecord[] = [];
	const warnings: string[] = [];
	const swimmers = new SwimmerRegistry();
	const teams = new Map<string, Team>();
	const events = new Map<string, MeetEvent>();
	const entries = new Map<string, IndividualEntry | RelayEntry>();
	const athletes = new Map<string, Athlete>();
	const badChecksums: number[] = [];

	let teamCode: string | undefined;
	let currentAthlete: Athlete | undefined;
	let lastResult: ResultDraft | undefined;
	let lastRelay: RelayEntry | undefined;

	const warn = (lineNo: number, message: string) => warnings.push(`line ${lineNo}: ${message}`);

	const readEvent = (
		line: string,
		lineNo: number,
		type: EventType,
		distanceAt: [number, number],
		course: Course | undefined
	): MeetEvent | undefined => {
		const sexCode = line.charAt(14);
		const strokeCode = line.charAt(21);
		const stroke = (type === 'relay' ? RELAY_STROKES : INDIVIDUAL_STROKES)[strokeCode];
		if (!isSexCode(sexCode)) {
			warn(lineNo, `unknown event sex code "${sexCode}"; skipped`);
			return undefined;
		}
		if (!stroke) {
			warn(lineNo, `unknown stroke code "${strokeCode}"; skipped`);
			return undefined;
		}
		const base = {
			type,
			gender: genderFromSexCode(sexCode) ?? 'X',
			sexCode,
			distance: Number.parseInt(cut(line, ...distanceAt), 10) || 0,
			stroke,
			course,
			ageBand: parseAgeCode(cut(line, 22, 25), cut(line, 25, 28))
		};
		const number = cut(line, 38, 42);
		const id = number && number !== '0' ? number : `u:${eventKey(base)}`;
		let event = events.get(id);
		if (!event) {
			event = compact({ id, number: number === '0' ? '' : number, ...base });
			events.set(id, event);
		} else if (!event.course && course) {
			event = { ...event, course };
			events.set(id, event);
		}
		return event;
	};

	const readResult = (result: string, timeAt: [number, number]): ResultDraft | undefined => {
		const round = ROUNDS[result.charAt(2)];
		if (!round) return undefined;
		const status = STATUS[result.charAt(12)] ?? 'ok';
		return compact({
			round,
			time: swimTimeFromSeconds(result.slice(...timeAt)),
			status,
			place: intOrUndefined(cut(result, 30, 33)),
			heat: intOrUndefined(cut(result, 21, 23)),
			lane: intOrUndefined(cut(result, 24, 26))
		});
	};

	lines.forEach((line, index) => {
		const lineNo = index + 1;
		if (!line.trim()) return;
		const code = line.slice(0, 2);
		records.push({ code, line: lineNo, text: line });
		if (checksumMode !== 'ignore' && line.length >= 130) {
			if (hy3Checksum(line) !== line.slice(128, 130)) {
				if (checksumMode === 'error')
					throw new Hy3ReadError(`HY3 checksum mismatch on line ${lineNo}`);
				badChecksums.push(lineNo);
			}
		}
		const next = lines[index + 1] ?? '';

		switch (code) {
			case 'A1':
				Object.assign(
					source,
					compact({
						software: cut(line, 44, 58) || undefined,
						createdAt: isoFromMmddyyyy(cut(line, 58, 66))
					})
				);
				break;
			case 'B1':
				meet.name = cut(line, 2, 47);
				if (isoFromMmddyyyy(cut(line, 92, 100)))
					meet.startDate = isoFromMmddyyyy(cut(line, 92, 100));
				break;
			case 'C1': {
				teamCode = cut(line, 2, 7);
				if (!teams.has(teamCode)) teams.set(teamCode, { code: teamCode, name: cut(line, 7, 37) });
				break;
			}
			case 'D1': {
				const number = cut(line, 3, 8);
				const gender = line.charAt(2);
				const name = {
					last: cut(line, 8, 28),
					first: cut(line, 28, 48),
					middle: cut(line, 68, 69) || undefined
				};
				const swimmer = swimmers.upsert(name, {
					gender: gender === 'M' || gender === 'F' ? gender : undefined,
					birthDate: isoFromMmddyyyy(cut(line, 88, 96)),
					preferredName: cut(line, 48, 68) || undefined,
					teamCode
				});
				swimmers.addId(swimmer, { system: 'hy3:athlete-number', value: number });
				swimmers.addId(swimmer, { system: 'hy3:registration', value: cut(line, 69, 83) });
				const display = `${name.last}, ${name.first}${name.middle ? ` ${name.middle}` : ''}`;
				currentAthlete = { swimmerId: swimmer.id, name: display, teamCode };
				athletes.set(number, currentAthlete);
				break;
			}
			case 'E1': {
				const pair = next.startsWith('E2') ? next : '';
				const athlete = athletes.get(cut(line, 3, 8)) ?? currentAthlete;
				if (!athlete) {
					warn(lineNo, 'E1 before any D1 athlete record; skipped');
					return;
				}
				const event = readEvent(
					line,
					lineNo,
					'individual',
					[15, 21],
					courseFromCode(pair.charAt(11))
				);
				if (!event) return;
				const key = `${event.id}|${athlete.swimmerId}`;
				let entry = entries.get(key) as IndividualEntry | undefined;
				if (!entry) {
					entry = compact({
						kind: 'individual' as const,
						eventId: event.id,
						swimmerId: athlete.swimmerId,
						teamCode: athlete.teamCode,
						seedTime: swimTimeFromSeconds(line.slice(52, 59)) ?? undefined,
						entryFee: numberOrUndefined(line.slice(32, 38)),
						results: [] as Result[]
					});
					entries.set(key, entry);
				}
				lastResult = pair ? readResult(pair, [4, 11]) : undefined;
				if (lastResult) (entry.results as Result[]).push(lastResult);
				lastRelay = undefined;
				break;
			}
			case 'F1': {
				const pair = next.startsWith('F2') ? next : '';
				const event = readEvent(line, lineNo, 'relay', [18, 21], courseFromCode(pair.charAt(11)));
				if (!event) return;
				const relayTeam = teamCode ?? cut(line, 2, 6);
				const letter = cut(line, 7, 8);
				const key = `${event.id}|${relayTeam}|${letter}`;
				let relay = entries.get(key) as RelayEntry | undefined;
				if (!relay) {
					relay = compact({
						kind: 'relay' as const,
						eventId: event.id,
						teamCode: relayTeam,
						relayLetter: letter,
						seedTime: swimTimeFromSeconds(line.slice(52, 59)) ?? undefined,
						entryFee: numberOrUndefined(line.slice(32, 38)),
						results: [] as Result[],
						legs: [] as RelayLeg[]
					});
					entries.set(key, relay);
				}
				lastResult = pair ? readResult(pair, [5, 11]) : undefined;
				if (lastResult) (relay.results as Result[]).push(lastResult);
				lastRelay = relay;
				break;
			}
			case 'F3': {
				if (!lastRelay) {
					warn(lineNo, 'F3 without a preceding F1 relay record; skipped');
					return;
				}
				const legs = lastRelay.legs as RelayLeg[];
				if (legs.length > 0) break;
				for (let offset = 2; offset + 13 <= Math.min(line.length, 128); offset += 13) {
					const slot = line.slice(offset, offset + 13);
					const number = slot.slice(1, 6).trim();
					if (!number) continue;
					const athlete = athletes.get(number);
					const order = Number.parseInt(slot.charAt(12), 10);
					legs.push(
						compact({
							swimmerId: athlete?.swimmerId,
							name: athlete?.name ?? slot.slice(6, 11).trim(),
							order: Number.isNaN(order) ? legs.length + 1 : order
						})
					);
				}
				break;
			}
			case 'H1':
				if (lastResult?.status === 'dq') {
					lastResult.dqCode = cut(line, 2, 4);
					lastResult.dqReason = cut(line, 4, 52);
				}
				break;
		}
	});

	if (badChecksums.length > 0) {
		warnings.push(
			`${badChecksums.length} line(s) failed the HY3 checksum; first at line ${badChecksums[0]}`
		);
	}

	meet.teams = [...teams.values()];
	meet.swimmers = swimmers.list();
	meet.events = [...events.values()];
	meet.entries = [...entries.values()];
	const courses = new Set(meet.events.map((e) => e.course).filter(Boolean));
	if (courses.size === 1) meet.course = [...courses][0];
	return { format: 'hy3', source, meet, records, warnings };
}
