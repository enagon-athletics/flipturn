// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import { parseAgeCode } from '../core/age-band.js';
import { courseFromCode, eventKey, genderFromSexCode, isSexCode } from '../core/codes.js';
import { isoFromMmddyyyy } from '../core/dates.js';
import { parseSwimTime, type SwimTime } from '../core/swim-time.js';
import { toText } from '../core/text.js';
import type {
	Course,
	Entry,
	EventType,
	FileSource,
	MeetEvent,
	RawRecord,
	ReaderInput,
	ReadResult,
	RelayLeg,
	Result,
	ResultStatus,
	Round,
	Stroke,
	Team
} from '../core/types.js';
import {
	address,
	compact,
	emptyMeet,
	intOrUndefined,
	numberOrUndefined,
	splitLines,
	splitName,
	SwimmerRegistry,
	type Mutable
} from '../internal/builder.js';

const STROKES: Readonly<Record<string, Stroke>> = {
	'1': 'FREE',
	'2': 'BACK',
	'3': 'BREAST',
	'4': 'FLY',
	'5': 'IM',
	'6': 'FREE',
	'7': 'MEDLEY'
};

/** 1-based column layout of the result slots, per the SDIF v3 spec. */
interface SlotLayout {
	readonly seed: number;
	readonly prelim: number;
	readonly swimoff: number;
	readonly final: number;
	readonly prelimHeat: number;
	readonly prelimLane: number;
	readonly finalHeat: number;
	readonly finalLane: number;
	readonly prelimPlace: number;
	readonly finalPlace: number;
	readonly points: number;
}

const D0_SLOTS: SlotLayout = {
	seed: 89,
	prelim: 98,
	swimoff: 107,
	final: 116,
	prelimHeat: 125,
	prelimLane: 127,
	finalHeat: 129,
	finalLane: 131,
	prelimPlace: 133,
	finalPlace: 136,
	points: 139
};

const E0_SLOTS: SlotLayout = {
	seed: 46,
	prelim: 55,
	swimoff: 64,
	final: 73,
	prelimHeat: 82,
	prelimLane: 84,
	finalHeat: 86,
	finalLane: 88,
	prelimPlace: 90,
	finalPlace: 93,
	points: 96
};

const col = (line: string, start: number, length: number): string =>
	line.slice(start - 1, start - 1 + length).trim();

interface TimeSlot {
	readonly time: SwimTime | null;
	readonly status: ResultStatus;
	readonly course?: Course;
}

function readTimeSlot(line: string, start: number): TimeSlot | undefined {
	const raw = col(line, start, 8).toUpperCase();
	const courseCode = col(line, start + 8, 1).toUpperCase();
	if (!raw) return undefined;
	const course = courseFromCode(courseCode);
	if (raw.startsWith('SCR')) return { time: null, status: 'scratch', course };
	if (raw.startsWith('DNF')) return { time: null, status: 'dnf', course };
	let time: SwimTime | null;
	try {
		time = parseSwimTime(raw);
	} catch {
		time = null;
	}
	const status: ResultStatus =
		time?.kind === 'dq' || courseCode === 'X' ? 'dq' : time?.kind === 'ns' ? 'ns' : 'ok';
	return { time, status, course };
}

type ResultDraft = Mutable<Result>;

function readResults(line: string, slots: SlotLayout): ResultDraft[] {
	const rounds: [Round, number, number | undefined, number | undefined, number | undefined][] = [
		['prelim', slots.prelim, slots.prelimPlace, slots.prelimHeat, slots.prelimLane],
		['swimoff', slots.swimoff, undefined, undefined, undefined],
		['final', slots.final, slots.finalPlace, slots.finalHeat, slots.finalLane]
	];
	const results: ResultDraft[] = [];
	for (const [round, start, placeAt, heatAt, laneAt] of rounds) {
		const slot = readTimeSlot(line, start);
		const place = placeAt ? intOrUndefined(col(line, placeAt, 3)) : undefined;
		if (!slot && place === undefined) continue;
		const points = round === 'final' ? numberOrUndefined(col(line, slots.points, 4)) : undefined;
		results.push(
			compact({
				round,
				time: slot?.time ?? null,
				status: slot?.status ?? 'ok',
				place,
				heat: heatAt ? intOrUndefined(col(line, heatAt, 2)) : undefined,
				lane: laneAt ? intOrUndefined(col(line, laneAt, 2)) : undefined,
				points: points ? points : undefined
			})
		);
	}
	return results;
}

interface SplitBuffer {
	readonly times: number[];
	interval: boolean;
	distance?: number;
}

export function readSdif(input: ReaderInput): ReadResult<'sdif'> {
	const lines = splitLines(toText(input));
	const meet = emptyMeet();
	const source: Mutable<FileSource> = {};
	const records: RawRecord[] = [];
	const warnings: string[] = [];
	const swimmers = new SwimmerRegistry();
	const teams = new Map<string, Mutable<Team>>();
	const events = new Map<string, MeetEvent>();
	const entries: Entry[] = [];
	const splits = new Map<ResultDraft, SplitBuffer>();

	let team: Mutable<Team> | undefined;
	let lastSwimmer: ReturnType<SwimmerRegistry['upsert']> | undefined;
	let lastResults: ResultDraft[] | undefined;
	let lastRelay: { legs: RelayLeg[]; teamCode: string } | undefined;

	const warn = (lineNo: number, message: string) => warnings.push(`line ${lineNo}: ${message}`);

	const readEvent = (
		line: string,
		lineNo: number,
		type: EventType,
		at: {
			sex: number;
			distance: number;
			stroke: number;
			number: number;
			age: number;
			date: number;
		},
		course: Course | undefined
	): MeetEvent | undefined => {
		const sexCode = col(line, at.sex, 1);
		const strokeCode = col(line, at.stroke, 1);
		const stroke = STROKES[strokeCode];
		if (!isSexCode(sexCode)) {
			warn(lineNo, `unknown event sex code "${sexCode}"; skipped`);
			return undefined;
		}
		if (!stroke) {
			warn(lineNo, `unknown stroke code "${strokeCode}"; skipped`);
			return undefined;
		}
		const age = line.slice(at.age - 1, at.age + 3).padEnd(4);
		const base = {
			type,
			gender: genderFromSexCode(sexCode) ?? 'X',
			sexCode,
			distance: Number.parseInt(col(line, at.distance, 4), 10) || 0,
			stroke,
			course: course ?? meet.course,
			ageBand: parseAgeCode(age.slice(0, 2), age.slice(2, 4))
		};
		const number = col(line, at.number, 4);
		const id = number && number !== '0' ? number : `u:${eventKey(base)}`;
		let event = events.get(id);
		if (!event) {
			event = compact({
				id,
				number: number === '0' ? '' : number,
				...base,
				date: isoFromMmddyyyy(col(line, at.date, 8))
			});
			events.set(id, event);
		}
		return event;
	};

	const eventCourse = (line: string, slots: SlotLayout) =>
		[slots.final, slots.prelim, slots.swimoff]
			.map((start) => courseFromCode(col(line, start + 8, 1)))
			.find(Boolean);

	lines.forEach((line, index) => {
		const lineNo = index + 1;
		if (!line.trim()) return;
		const code = line.slice(0, 2);
		records.push({ code, line: lineNo, text: line });

		switch (code) {
			case 'A0':
				Object.assign(
					source,
					compact({
						software: col(line, 44, 20) || undefined,
						version: col(line, 64, 10) || undefined,
						createdAt: isoFromMmddyyyy(col(line, 106, 8))
					})
				);
				break;
			case 'B1':
				Object.assign(
					meet,
					compact({
						name: col(line, 12, 30),
						address: address({
							line1: col(line, 42, 22),
							line2: col(line, 64, 22),
							city: col(line, 86, 20),
							state: col(line, 106, 2),
							postalCode: col(line, 108, 10),
							country: col(line, 118, 3)
						}),
						meetType: col(line, 121, 1) || undefined,
						startDate: isoFromMmddyyyy(col(line, 122, 8)),
						endDate: isoFromMmddyyyy(col(line, 130, 8)),
						course: courseFromCode(col(line, 150, 1))
					})
				);
				break;
			case 'B2':
				meet.host ??= compact({
					name: col(line, 12, 30),
					address: address({
						line1: col(line, 42, 22),
						line2: col(line, 64, 22),
						city: col(line, 86, 20),
						state: col(line, 106, 2),
						postalCode: col(line, 108, 10),
						country: col(line, 118, 3)
					}),
					phone: col(line, 121, 12) || undefined
				});
				break;
			case 'C1': {
				const teamCode = col(line, 12, 6) + col(line, 150, 1);
				team = teams.get(teamCode);
				if (!team) {
					team = compact({
						code: teamCode,
						name: col(line, 18, 30),
						shortName: col(line, 48, 16) || undefined,
						address: address({
							line1: col(line, 64, 22),
							line2: col(line, 86, 22),
							city: col(line, 108, 20),
							state: col(line, 128, 2),
							postalCode: col(line, 130, 10),
							country: col(line, 140, 3)
						})
					});
					teams.set(teamCode, team);
				}
				lastResults = undefined;
				lastRelay = undefined;
				break;
			}
			case 'C2': {
				const target = teams.get(col(line, 12, 6) + col(line, 150, 1)) ?? team;
				const name = col(line, 18, 30);
				if (target && name) target.coach = compact({ name, phone: col(line, 48, 12) || undefined });
				break;
			}
			case 'D0': {
				lastRelay = undefined;
				if (!team) {
					warn(lineNo, 'D0 before any C1 team record; skipped');
					lastResults = undefined;
					return;
				}
				const sex = col(line, 66, 1);
				const attach = col(line, 52, 1);
				lastSwimmer = swimmers.upsert(splitName(col(line, 12, 28)), {
					gender: sex === 'M' || sex === 'F' ? sex : undefined,
					birthDate: isoFromMmddyyyy(col(line, 56, 8)),
					age: intOrUndefined(col(line, 64, 2)),
					teamCode: team.code,
					citizenship: col(line, 53, 3) || undefined,
					attached: attach === 'A' ? true : attach === 'U' ? false : undefined
				});
				swimmers.addId(lastSwimmer, { system: 'sdif:uss', value: col(line, 40, 12) });
				if (!col(line, 67, 1) && !col(line, 68, 4) && !col(line, 72, 1)) {
					lastResults = undefined;
					return;
				}
				const results = readResults(line, D0_SLOTS);
				const event = readEvent(
					line,
					lineNo,
					'individual',
					{ sex: 67, distance: 68, stroke: 72, number: 73, age: 77, date: 81 },
					eventCourse(line, D0_SLOTS)
				);
				if (!event) return;
				const seed = readTimeSlot(line, D0_SLOTS.seed);
				entries.push(
					compact({
						kind: 'individual' as const,
						eventId: event.id,
						swimmerId: lastSwimmer.id,
						teamCode: team.code,
						seedTime: seed?.time ?? undefined,
						seedCourse: seed?.course,
						results
					})
				);
				lastResults = results;
				break;
			}
			case 'D3':
				if (lastSwimmer) {
					swimmers.addId(lastSwimmer, { system: 'sdif:uss-new', value: col(line, 3, 14) });
					lastSwimmer.preferredName ??= col(line, 17, 15) || undefined;
					if (lastSwimmer.preferredName === undefined) delete lastSwimmer.preferredName;
				}
				break;
			case 'E0': {
				if (!team) {
					warn(lineNo, 'E0 before any C1 team record; skipped');
					return;
				}
				const results = readResults(line, E0_SLOTS);
				const event = readEvent(
					line,
					lineNo,
					'relay',
					{ sex: 21, distance: 22, stroke: 26, number: 27, age: 31, date: 38 },
					eventCourse(line, E0_SLOTS)
				);
				if (!event) return;
				const seed = readTimeSlot(line, E0_SLOTS.seed);
				const relay = compact({
					kind: 'relay' as const,
					eventId: event.id,
					teamCode: col(line, 13, 6) || team.code,
					relayLetter: col(line, 12, 1),
					seedTime: seed?.time ?? undefined,
					seedCourse: seed?.course,
					results,
					legs: [] as RelayLeg[]
				});
				entries.push(relay);
				lastRelay = relay;
				lastResults = results;
				break;
			}
			case 'F0': {
				if (!lastRelay) {
					warn(lineNo, 'F0 without a preceding E0 relay record; skipped');
					return;
				}
				const name = col(line, 23, 28);
				const sex = col(line, 76, 1);
				const swimmer = swimmers.upsert(splitName(name), {
					gender: sex === 'M' || sex === 'F' ? sex : undefined,
					birthDate: isoFromMmddyyyy(col(line, 66, 8)),
					age: intOrUndefined(col(line, 74, 2)),
					teamCode: col(line, 16, 6) || lastRelay.teamCode,
					citizenship: col(line, 63, 3) || undefined,
					preferredName: col(line, 107, 15) || undefined
				});
				swimmers.addId(swimmer, { system: 'sdif:uss', value: col(line, 51, 12) });
				swimmers.addId(swimmer, { system: 'sdif:uss-new', value: col(line, 93, 14) });
				const orders = [col(line, 79, 1), col(line, 77, 1), col(line, 78, 1)];
				const stated = orders.find((o) => o && o !== '0');
				const legTime = readTimeSlot(line, 80);
				lastRelay.legs.push(
					compact({
						swimmerId: swimmer.id,
						name,
						order:
							stated === 'A'
								? ('alternate' as const)
								: Number.parseInt(stated ?? '', 10) || lastRelay.legs.length + 1,
						legTime: legTime?.time?.kind === 'time' ? legTime.time : undefined
					})
				);
				break;
			}
			case 'G0': {
				if (!lastResults || lastResults.length === 0) {
					warn(lineNo, 'G0 without a preceding swim; skipped');
					return;
				}
				const round = ({ P: 'prelim', S: 'swimoff', F: 'final' } as const)[
					col(line, 144, 1) as 'P' | 'S' | 'F'
				];
				const target =
					lastResults.find((r) => r.round === round) ?? (round ? undefined : lastResults.at(-1));
				if (!target) {
					warn(lineNo, `G0 for a ${round} round the swim does not have; skipped`);
					return;
				}
				let buffer = splits.get(target);
				if (!buffer) {
					buffer = { times: [], interval: false };
					splits.set(target, buffer);
				}
				buffer.interval = col(line, 63, 1) === 'I';
				buffer.distance ??= intOrUndefined(col(line, 59, 4));
				for (let i = 0; i < 10; i++) {
					const raw = col(line, 64 + i * 8, 8);
					if (!raw) continue;
					try {
						const time = parseSwimTime(raw);
						if (time.kind === 'time') buffer.times.push(time.hundredths);
					} catch {
						warn(lineNo, `unreadable split "${raw}"; skipped`);
					}
				}
				break;
			}
		}
	});

	for (const [result, buffer] of splits) {
		let running = 0;
		result.splits = buffer.interval ? buffer.times.map((t) => (running += t)) : buffer.times;
		if (buffer.distance !== undefined) result.splitDistance = buffer.distance;
	}

	meet.teams = [...teams.values()];
	meet.swimmers = swimmers.list();
	meet.events = [...events.values()];
	meet.entries = entries;
	return { format: 'sdif', source, meet, records, warnings };
}
