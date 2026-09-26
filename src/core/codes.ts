// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
import type { AgeBand, Course, EventType, Gender, SexCode, Stroke } from './types.js';

const SEX_TO_GENDER: Readonly<Record<SexCode, Gender>> = {
	M: 'M',
	B: 'M',
	F: 'F',
	G: 'F',
	W: 'F',
	X: 'X'
};

export function isSexCode(code: string): code is SexCode {
	return Object.hasOwn(SEX_TO_GENDER, code);
}

export function genderFromSexCode(code: string): Gender | undefined {
	return isSexCode(code) ? SEX_TO_GENDER[code] : undefined;
}

const COURSE_BY_CODE: Readonly<Record<string, Course>> = {
	S: 'SCM',
	'1': 'SCM',
	Y: 'SCY',
	'2': 'SCY',
	L: 'LCM',
	'3': 'LCM'
};

/** SDIF/Hy-Tek course code (alpha or numeric form) to a course. */
export function courseFromCode(code: string): Course | undefined {
	return COURSE_BY_CODE[code.trim().toUpperCase()];
}

export const COURSE_LETTER: Readonly<Record<Course, 'S' | 'Y' | 'L'>> = {
	SCM: 'S',
	SCY: 'Y',
	LCM: 'L'
};

export interface EventIdentity {
	readonly type: EventType;
	readonly gender: Gender;
	readonly ageBand: AgeBand;
	readonly distance: number;
	readonly stroke: Stroke;
	readonly course?: Course;
}

/** Stable identity for joining events across files: never built from wording or numbering. */
export function eventKey(event: EventIdentity): string {
	const { min, max } = event.ageBand;
	return [
		event.type,
		event.gender,
		`${min ?? 'UN'}-${max ?? 'OV'}`,
		event.distance,
		event.stroke,
		event.course ?? '?'
	].join(':');
}
