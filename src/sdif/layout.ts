// Field offsets are from the SDIF v3 specification, cross-checked against swimparse and swimlib.
import type { FieldSpec } from './fixed-width.js';

const f = (start: number, length: number, extra: Omit<FieldSpec, 'start' | 'length'> = {}) => ({
	start,
	length,
	...extra
});
const text = { truncate: true } as const;
const int = { align: 'right' } as const;
const numeric = { align: 'numeric' } as const;

export const A0 = {
	org: f(3, 1),
	version: f(4, 8),
	fileCode: f(12, 2),
	software: f(44, 20, text),
	softwareVersion: f(64, 10, text),
	contactName: f(74, 20, text),
	contactPhone: f(94, 12),
	created: f(106, 8)
};

export const B1 = {
	org: f(3, 1),
	name: f(12, 30, text),
	line1: f(42, 22, text),
	line2: f(64, 22, text),
	city: f(86, 20, text),
	state: f(106, 2),
	postalCode: f(108, 10),
	country: f(118, 3),
	meetType: f(121, 1),
	start: f(122, 8),
	end: f(130, 8),
	course: f(150, 1)
};

export const B2 = {
	org: f(3, 1),
	name: f(12, 30, text),
	line1: f(42, 22, text),
	line2: f(64, 22, text),
	city: f(86, 20, text),
	state: f(106, 2),
	postalCode: f(108, 10),
	country: f(118, 3),
	phone: f(121, 12)
};

export const C1 = {
	org: f(3, 1),
	code: f(12, 6),
	name: f(18, 30, text),
	shortName: f(48, 16, text),
	line1: f(64, 22, text),
	line2: f(86, 22, text),
	city: f(108, 20, text),
	state: f(128, 2),
	postalCode: f(130, 10),
	country: f(140, 3),
	codeFifth: f(150, 1)
};

export const C2 = {
	org: f(3, 1),
	code: f(12, 6),
	coach: f(18, 30, text),
	phone: f(48, 12),
	individualEntries: f(60, 6, int),
	athletes: f(66, 6, int),
	relayEntries: f(72, 5, int),
	relaySwimmers: f(77, 6, int),
	splits: f(83, 6, int),
	shortName: f(89, 16, text),
	codeFifth: f(150, 1)
};

export const D0 = {
	org: f(3, 1),
	name: f(12, 28, text),
	uss: f(40, 12),
	attach: f(52, 1),
	citizen: f(53, 3),
	birth: f(56, 8),
	age: f(64, 2, numeric),
	sex: f(66, 1),
	eventSex: f(67, 1),
	distance: f(68, 4, int),
	stroke: f(72, 1),
	eventNumber: f(73, 4, numeric),
	eventAge: f(77, 4),
	swimDate: f(81, 8),
	seed: f(89, 8),
	seedCourse: f(97, 1)
};

export const D3 = {
	ussNew: f(3, 14),
	preferredName: f(17, 15, text)
};

export const E0 = {
	org: f(3, 1),
	letter: f(12, 1),
	team: f(13, 6),
	legCount: f(19, 2, int),
	eventSex: f(21, 1),
	distance: f(22, 4, int),
	stroke: f(26, 1),
	eventNumber: f(27, 4, numeric),
	eventAge: f(31, 4),
	swimDate: f(38, 8),
	seed: f(46, 8),
	seedCourse: f(54, 1)
};

export const F0 = {
	org: f(3, 1),
	team: f(16, 6),
	letter: f(22, 1),
	name: f(23, 28, text),
	uss: f(51, 12),
	citizen: f(63, 3),
	birth: f(66, 8),
	age: f(74, 2, numeric),
	sex: f(76, 1),
	prelimLeg: f(77, 1),
	swimoffLeg: f(78, 1),
	finalLeg: f(79, 1),
	ussNew: f(93, 14),
	preferredName: f(107, 15, text)
};

export const Z0 = {
	org: f(3, 1),
	fileCode: f(12, 2),
	bRecords: f(44, 3, int),
	meets: f(47, 3, int),
	cRecords: f(50, 4, int),
	teams: f(54, 4, int),
	dRecords: f(58, 6, int),
	swimmers: f(64, 6, int),
	eRecords: f(70, 5, int),
	fRecords: f(75, 6, int),
	gRecords: f(81, 6, int)
};
