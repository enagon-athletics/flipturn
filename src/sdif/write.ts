import { COURSE_LETTER } from '../core/codes.js';
import { mmddyyyyFromIso } from '../core/dates.js';
import { SdifWriteError } from '../core/errors.js';
import { encodeWindows1252 } from '../core/text.js';
import type {
	AgeBand,
	Course,
	ExternalIdSystem,
	IndividualEntry,
	Meet,
	MeetEvent,
	RelayEntry,
	Stroke,
	Swimmer,
	Team
} from '../core/types.js';
import {
	formatRecord,
	formatSdifEventNumber,
	formatSdifTime,
	type FieldValues,
	type Layout
} from './fixed-width.js';
import { A0, B1, B2, C1, C2, D0, D3, E0, F0, Z0 } from './layout.js';

export interface SdifWriteOptions {
	/** Person supplying the file (A0, mandatory). */
	readonly contact: { readonly name: string; readonly phone: string };
	/** `canadian` makes the USS# optional; `standard` (the default) requires it. */
	readonly mode?: 'standard' | 'canadian';
	/** ISO file creation date; defaults to today (UTC). */
	readonly createdAt?: string;
	readonly software?: { readonly name?: string; readonly version?: string };
	/** SDIF ORG Code 001; defaults to `1` (USS). */
	readonly orgCode?: string;
	/** `team-unify` also fills the columns Team Unify's Standard SD3 writes beyond the spec. */
	readonly profile?: 'spec' | 'team-unify';
	/** A0 columns 14-43; defaults to `Meet Entries` in the `team-unify` profile. */
	readonly description?: string;
}

export interface SdifWriteResult {
	/** The file, CRLF line endings included; encode with `encodeWindows1252` for bytes. */
	readonly text: string;
	/** Blank M2 fields and truncations: the spec's exceptions report. */
	readonly warnings: readonly string[];
}

const INDIVIDUAL_STROKE: Partial<Record<Stroke, string>> = {
	FREE: '1',
	BACK: '2',
	BREAST: '3',
	FLY: '4',
	IM: '5'
};
const RELAY_STROKE: Partial<Record<Stroke, string>> = { FREE: '6', MEDLEY: '7', IM: '7' };

const twoDigits = (age: number | null, open: string) =>
	age === null ? open : String(age).padStart(2, '0');

function ageCode(band: AgeBand): string {
	return `${twoDigits(band.min, 'UN')}${twoDigits(band.max, 'OV')}`;
}

const idOf = (swimmer: Swimmer, system: ExternalIdSystem) =>
	swimmer.externalIds.find((id) => id.system === system)?.value;

const attachCode = (s: Swimmer) => (s.attached === false ? 'U' : 'A');

const fullName = (s: Swimmer) =>
	`${s.lastName}, ${s.firstName}${s.middleInitial ? ` ${s.middleInitial}` : ''}`;

function splitTeamCode(code: string): { code: string; codeFifth?: string } {
	return code.length === 7 ? { code: code.slice(0, 6), codeFifth: code.slice(6) } : { code };
}

interface TeamBlock {
	readonly team: Team;
	readonly bySwimmer: Map<string, IndividualEntry[]>;
	readonly relays: RelayEntry[];
}

/** Writes a standard SDIF v3 meet-entries file (A0 B1 [B2] C1 C2 D0 D3 E0 F0 Z0). */
export function writeSdifEntries(meet: Meet, options: SdifWriteOptions): SdifWriteResult {
	const issues: string[] = [];
	const warnings = new Set<string>();
	const canadian = options.mode === 'canadian';
	const org = options.orgCode ?? '1';
	const teamUnify = options.profile === 'team-unify';
	const codeAlign = teamUnify ? 'right' : 'left';

	const events = new Map(meet.events.map((e) => [e.id, e]));
	const swimmers = new Map(meet.swimmers.map((s) => [s.id, s]));
	const blocks = new Map<string, TeamBlock>(
		meet.teams.map((team) => [team.code, { team, bySwimmer: new Map(), relays: [] }])
	);

	if (!options.contact.name) issues.push('contact name is required');
	if (!options.contact.phone) issues.push('contact phone is required');
	if (!meet.name) issues.push('meet name is required');
	if (!meet.startDate) issues.push('meet start date is required');
	if (!meet.address?.city) warnings.add('meet city is blank');
	if (!meet.address?.state) warnings.add('meet state is blank');
	if (!meet.meetType) warnings.add('meet type is blank');
	if (!meet.endDate) warnings.add('meet end date is blank');
	const { altitude } = meet;
	if (
		altitude !== undefined &&
		!(Number.isInteger(altitude) && altitude >= 0 && altitude <= 9999)
	) {
		issues.push('meet altitude must be a whole number of feet from 0 to 9999');
	}
	for (const team of meet.teams) {
		if (!team.code || !team.name) issues.push(`team ${team.code || '?'} needs a code and a name`);
	}

	for (const entry of meet.entries) {
		if (!events.has(entry.eventId)) {
			issues.push(`entry references unknown event ${entry.eventId}`);
			continue;
		}
		if (entry.kind === 'relay') {
			const block = blocks.get(entry.teamCode);
			if (block) block.relays.push(entry);
			else issues.push(`relay references unknown team ${entry.teamCode}`);
			continue;
		}
		const swimmer = swimmers.get(entry.swimmerId);
		const block = blocks.get(entry.teamCode ?? swimmer?.teamCode ?? '');
		if (!swimmer) issues.push(`entry references unknown swimmer ${entry.swimmerId}`);
		else if (!block) issues.push(`swimmer ${swimmer.id} has no known team`);
		else block.bySwimmer.set(swimmer.id, [...(block.bySwimmer.get(swimmer.id) ?? []), entry]);
	}
	if (issues.length > 0) throw new SdifWriteError(issues);

	const lines: string[] = [];
	const counts = { b: 0, c: 0, d: 0, e: 0, f: 0, swimmers: 0 };
	const truncated = (value: string, length: number) =>
		warnings.add(`name "${value}" truncated to ${length} characters`);
	const emit = <L extends Layout>(code: string, layout: L, values: FieldValues<L>) =>
		lines.push(formatRecord(code, layout, values, truncated));

	const checked = new Set<string>();
	const checkSwimmer = (swimmer: Swimmer) => {
		if (checked.has(swimmer.id)) return;
		checked.add(swimmer.id);
		if (!swimmer.gender) issues.push(`swimmer ${swimmer.id} has no gender`);
		if (!idOf(swimmer, 'sdif:uss') && !canadian) {
			issues.push(`swimmer ${swimmer.id} has no USS# (use canadian mode to make it optional)`);
		}
		if (!swimmer.birthDate) warnings.add(`swimmer ${swimmer.id} has no birth date`);
	};

	const seedCourse = (course: Course | undefined, event: MeetEvent) => {
		const resolved = course ?? event.course ?? meet.course;
		if (!resolved) issues.push(`event ${event.id} seed has no course`);
		return resolved ? COURSE_LETTER[resolved] : undefined;
	};

	const eventFields = (event: MeetEvent, strokes: Partial<Record<Stroke, string>>) => {
		const stroke = strokes[event.stroke];
		if (!stroke) issues.push(`event ${event.id} has a stroke SDIF cannot carry (${event.stroke})`);
		return {
			eventSex: event.gender,
			distance: event.distance,
			stroke,
			eventNumber: teamUnify ? formatSdifEventNumber(event.number) : event.number,
			eventAge: ageCode(event.ageBand),
			swimDate: event.date ? mmddyyyyFromIso(event.date) : undefined
		};
	};

	const person = (swimmer: Swimmer) => ({
		org,
		name: fullName(swimmer),
		uss: idOf(swimmer, 'sdif:uss'),
		citizen: swimmer.citizenship,
		birth: swimmer.birthDate ? mmddyyyyFromIso(swimmer.birthDate) : undefined,
		age: swimmer.age,
		sex: swimmer.gender
	});

	const d3 = (swimmer: Swimmer) => {
		emit('D3', D3, {
			ussNew: idOf(swimmer, 'sdif:uss-new'),
			preferredName: swimmer.preferredName,
			...(teamUnify && {
				participation: 'F'.repeat(13),
				middleName: swimmer.middleName,
				trailer: 'N'
			})
		});
		counts.d += 1;
	};

	const created = options.createdAt ?? new Date().toISOString().slice(0, 10);
	emit('A0', A0, {
		org,
		version: 'V3',
		fileCode: '01',
		description: options.description ?? (teamUnify ? 'Meet Entries' : undefined),
		software: options.software?.name ?? 'flipturn',
		softwareVersion: options.software?.version,
		contactName: options.contact.name,
		contactPhone: options.contact.phone,
		created: mmddyyyyFromIso(created)
	});
	emit('B1', B1, {
		org,
		name: meet.name,
		...meet.address,
		meetType: meet.meetType,
		start: meet.startDate ? mmddyyyyFromIso(meet.startDate) : undefined,
		end: meet.endDate ? mmddyyyyFromIso(meet.endDate) : undefined,
		altitude: altitude ?? (teamUnify ? 0 : undefined),
		course: meet.course ? COURSE_LETTER[meet.course] : undefined
	});
	counts.b += 1;
	if (meet.host) {
		emit('B2', B2, { org, name: meet.host.name, ...meet.host.address, phone: meet.host.phone });
		counts.b += 1;
	}

	for (const { team, bySwimmer, relays } of blocks.values()) {
		const code = splitTeamCode(team.code);
		const relayOnly = new Map<string, Swimmer>();
		for (const relay of relays) {
			for (const leg of relay.legs) {
				const swimmer = leg.swimmerId ? swimmers.get(leg.swimmerId) : undefined;
				if (!swimmer) issues.push(`relay leg ${leg.name} has no known swimmer`);
				else if (!bySwimmer.has(swimmer.id)) relayOnly.set(swimmer.id, swimmer);
			}
		}
		const individualCount = [...bySwimmer.values()].reduce((n, list) => n + list.length, 0);
		const legCount = relays.reduce((n, r) => n + r.legs.length, 0);

		emit('C1', C1, { org, ...code, name: team.name, shortName: team.shortName, ...team.address });
		counts.c += 1;
		if (!team.coach?.name && !teamUnify) warnings.add(`team ${team.code} has no coach name`);
		if (team.coach?.name || !teamUnify) {
			emit('C2', C2, {
				org,
				...code,
				coach: team.coach?.name,
				phone: team.coach?.phone,
				individualEntries: individualCount + relayOnly.size,
				athletes: bySwimmer.size + relayOnly.size,
				relayEntries: relays.length,
				relaySwimmers: legCount,
				splits: 0
			});
			counts.c += 1;
		}
		const region = teamUnify ? team.code.slice(0, 2) : undefined;

		for (const [swimmerId, list] of bySwimmer) {
			const swimmer = swimmers.get(swimmerId) as Swimmer;
			checkSwimmer(swimmer);
			list.forEach((entry, index) => {
				const event = events.get(entry.eventId) as MeetEvent;
				emit('D0', D0, {
					...person(swimmer),
					region,
					attach: attachCode(swimmer),
					...eventFields(event, INDIVIDUAL_STROKE),
					seed: entry.seedTime ? formatSdifTime(entry.seedTime, codeAlign) : undefined,
					seedCourse: entry.seedTime ? seedCourse(entry.seedCourse, event) : undefined
				});
				counts.d += 1;
				if (index === 0) d3(swimmer);
			});
		}
		for (const swimmer of relayOnly.values()) {
			checkSwimmer(swimmer);
			emit('D0', D0, { ...person(swimmer), region, attach: attachCode(swimmer) });
			counts.d += 1;
			d3(swimmer);
		}
		counts.swimmers += bySwimmer.size + relayOnly.size;

		for (const relay of relays) {
			const event = events.get(relay.eventId) as MeetEvent;
			emit('E0', E0, {
				org,
				letter: relay.relayLetter,
				team: code.code,
				legCount: relay.legs.length,
				...eventFields(event, RELAY_STROKE),
				seed: relay.seedTime ? formatSdifTime(relay.seedTime, codeAlign) : undefined,
				seedCourse: relay.seedTime ? seedCourse(relay.seedCourse, event) : undefined
			});
			counts.e += 1;
			for (const leg of relay.legs) {
				const swimmer = swimmers.get(leg.swimmerId ?? '');
				if (!swimmer) continue;
				const order = leg.order === 'alternate' ? 'A' : String(leg.order);
				emit('F0', F0, {
					...person(swimmer),
					team: code.code,
					letter: relay.relayLetter,
					prelimLeg: order,
					swimoffLeg: '0',
					finalLeg: order,
					ussNew: idOf(swimmer, 'sdif:uss-new'),
					preferredName: swimmer.preferredName
				});
				counts.f += 1;
			}
		}
	}

	emit('Z0', Z0, {
		org,
		fileCode: '01',
		bRecords: counts.b,
		meets: 1,
		cRecords: counts.c,
		teams: blocks.size,
		dRecords: counts.d,
		swimmers: counts.swimmers,
		eRecords: counts.e,
		fRecords: counts.f,
		gRecords: 0,
		...(teamUnify && {
			batch: 1,
			newMembers: 0,
			renewMembers: 0,
			memberChanges: 0,
			memberDeletes: 0
		})
	});

	if (issues.length > 0) throw new SdifWriteError(issues);
	const text = lines.map((line) => `${line}\r\n`).join('');
	try {
		encodeWindows1252(text);
	} catch (error) {
		throw new SdifWriteError([error instanceof Error ? error.message : String(error)]);
	}
	return { text, warnings: [...warnings] };
}
