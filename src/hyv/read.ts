// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import { courseFromCode } from '../core/codes.js';
import type { SwimTime } from '../core/swim-time.js';
import { toText } from '../core/text.js';
import type {
	Course,
	MeetEvent,
	ReaderInput,
	ReadResult,
	SetupReadOptions,
	Stroke
} from '../core/types.js';
import { compact, emptyMeet, numberOrUndefined } from '../internal/builder.js';
import {
	clean,
	cut,
	eventSex,
	intOrNone,
	qualifying,
	setupDate,
	setupEvent,
	splitSetup
} from '../internal/setup.js';

const STROKES: Readonly<Record<string, Stroke>> = {
	'1': 'FREE',
	'2': 'BACK',
	'3': 'BREAST',
	'4': 'FLY',
	'5': 'IM'
};
const RELAY_STROKES: Readonly<Record<string, Stroke>> = { '1': 'FREE', '5': 'MEDLEY' };

// The three cut columns start at the meet's own course, then cycle Y, L, S.
const COURSE_CYCLE = ['Y', 'L', 'S'] as const;

function rotatedCuts(courseCode: string, f: string[], drop: boolean) {
	const start = Math.max(0, COURSE_CYCLE.indexOf(courseCode as 'Y'));
	const times: Partial<Record<Course, SwimTime>> = {};
	[9, 13, 15].forEach((column, i) => {
		const course = courseFromCode(COURSE_CYCLE[(start + i) % 3] ?? 'Y');
		if (course) times[course] = cut(f[column], drop);
	});
	return qualifying(times);
}

export function readHyv(input: ReaderInput, options: SetupReadOptions = {}): ReadResult<'hyv'> {
	const drop = options.placeholders === 'null';
	const { head, rows, records } = splitSetup(toText(input), 'hyv');
	const warnings: string[] = [];
	const courseCode = clean(head[4]).charAt(0);
	const course = courseFromCode(courseCode);

	const events: MeetEvent[] = [];
	for (const { fields: f, line } of rows) {
		const number = clean(f[0]);
		const type = clean(f[3]) === 'R' ? 'relay' : 'individual';
		const strokeCode = clean(f[7]);
		const stroke = (type === 'relay' ? RELAY_STROKES : STROKES)[strokeCode];
		const sexCode = eventSex(f[2], number);
		if (!stroke) {
			warnings.push(`line ${line}: unknown stroke code "${strokeCode}"; skipped`);
			continue;
		}
		const upper = clean(f[5]);
		events.push(
			setupEvent({
				number,
				type,
				sexCode,
				distance: intOrNone(f[6]) ?? 0,
				stroke,
				course,
				lower: clean(f[4]),
				upper: upper === '0' ? '109' : upper,
				extra: {
					prelimsFinals: clean(f[1]) === 'P',
					entryFee: numberOrUndefined(clean(f[11])),
					qualifyingTimes: rotatedCuts(courseCode, f, drop)
				}
			})
		);
	}

	const meet = emptyMeet();
	Object.assign(
		meet,
		compact({
			name: clean(head[0]),
			host: clean(head[5]) ? { name: clean(head[5]) } : undefined,
			startDate: setupDate(head[1]),
			endDate: setupDate(head[2]),
			ageUpDate: setupDate(head[3], drop),
			course
		})
	);
	meet.events = events;

	const source = compact({
		software: clean(head[7]) || undefined,
		version: clean(head[8]) || undefined
	});
	return { format: 'hyv', source, meet, records, warnings };
}
