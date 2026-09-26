// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import { courseFromCode } from '../core/codes.js';
import { toText } from '../core/text.js';
import type {
	MeetEvent,
	ReaderInput,
	ReadResult,
	SetupReadOptions,
	Stroke
} from '../core/types.js';
import { address, compact, emptyMeet, numberOrUndefined } from '../internal/builder.js';
import {
	clean,
	clockTime,
	cut,
	deriveSessions,
	eventSex,
	intOrNone,
	qualifying,
	setupDate,
	setupEvent,
	splitSetup
} from '../internal/setup.js';

const STROKES: Readonly<Record<string, Stroke>> = {
	A: 'FREE',
	B: 'BACK',
	C: 'BREAST',
	D: 'FLY',
	E: 'IM'
};
const RELAY_STROKES: Readonly<Record<string, Stroke>> = { A: 'FREE', E: 'MEDLEY' };

export function readEv3(input: ReaderInput, options: SetupReadOptions = {}): ReadResult<'ev3'> {
	const drop = options.placeholders === 'null';
	const { head, rows, records } = splitSetup(toText(input), 'ev3');
	const warnings: string[] = [];

	const stated = new Set(rows.map((r) => courseFromCode(clean(r.fields[25]))).filter(Boolean));
	const meetCourse = stated.size === 1 ? [...stated][0] : courseFromCode(clean(head[5]).charAt(0));

	const stamps = new Map<string, { day?: number; startTime?: string }>();
	const events: MeetEvent[] = [];
	for (const { fields: f, line } of rows) {
		const number = clean(f[1]) || clean(f[0]);
		const type = clean(f[4]) === 'R' ? 'relay' : 'individual';
		const strokeCode = clean(f[9]);
		const stroke = (type === 'relay' ? RELAY_STROKES : STROKES)[strokeCode];
		const sexCode = eventSex(f[5], number);
		if (!stroke) {
			warnings.push(`line ${line}: unknown stroke code "${strokeCode}"; skipped`);
			continue;
		}
		const sessionId = clean(f[21]) || undefined;
		if (sessionId && !stamps.has(sessionId)) {
			stamps.set(sessionId, compact({ day: intOrNone(f[23]), startTime: clockTime(f[24]) }));
		}
		events.push(
			setupEvent({
				number,
				type,
				sexCode,
				distance: intOrNone(f[8]) ?? 0,
				stroke,
				course: courseFromCode(clean(f[25])) ?? meetCourse,
				lower: clean(f[6]),
				upper: clean(f[7]),
				extra: {
					prelimsFinals: clean(f[2]) === 'P',
					rounds: intOrNone(f[3]),
					entryFee: numberOrUndefined(clean(f[14])),
					qualifyingTimes: qualifying({
						LCM: cut(f[16], drop),
						SCM: cut(f[18], drop),
						SCY: cut(f[20], drop)
					}),
					relayLegs: type === 'relay' ? intOrNone(f[29]) : undefined,
					sessionId,
					sessionOrder: sessionId ? intOrNone(f[22]) : undefined
				}
			})
		);
	}

	const meet = emptyMeet();
	Object.assign(
		meet,
		compact({
			name: clean(head[0]),
			host: clean(head[1]) ? { name: clean(head[1]) } : undefined,
			startDate: setupDate(head[2]),
			endDate: setupDate(head[3]),
			ageUpDate: setupDate(head[4], drop),
			course: meetCourse,
			sanction: clean(head[14]) || undefined,
			entryDeadline: setupDate(head[23]),
			address: address({
				line1: clean(head[24]),
				city: clean(head[26]),
				state: clean(head[27]),
				postalCode: clean(head[28]),
				country: clean(head[29])
			})
		})
	);
	meet.events = events;
	meet.sessions = deriveSessions(events, stamps);

	const source = compact({
		software: clean(head[9]) || undefined,
		version: clean(head[11]) || undefined,
		createdAt: setupDate(head[12])
	});
	return { format: 'ev3', source, meet, records, warnings };
}
