// Field offsets are from the SDIF v3 specification, cross-checked against swimparse and swimlib.

export const A0 = {
	org: { start: 3, length: 1 },
	version: { start: 4, length: 8 },
	fileCode: { start: 12, length: 2 },
	software: { start: 44, length: 20, truncate: true },
	softwareVersion: { start: 64, length: 10, truncate: true },
	contactName: { start: 74, length: 20, truncate: true },
	contactPhone: { start: 94, length: 12 },
	created: { start: 106, length: 8 }
} as const;

export const B1 = {
	org: { start: 3, length: 1 },
	name: { start: 12, length: 30, truncate: true },
	line1: { start: 42, length: 22, truncate: true },
	line2: { start: 64, length: 22, truncate: true },
	city: { start: 86, length: 20, truncate: true },
	state: { start: 106, length: 2 },
	postalCode: { start: 108, length: 10 },
	country: { start: 118, length: 3 },
	meetType: { start: 121, length: 1 },
	start: { start: 122, length: 8 },
	end: { start: 130, length: 8 },
	course: { start: 150, length: 1 }
} as const;

export const B2 = {
	org: { start: 3, length: 1 },
	name: { start: 12, length: 30, truncate: true },
	line1: { start: 42, length: 22, truncate: true },
	line2: { start: 64, length: 22, truncate: true },
	city: { start: 86, length: 20, truncate: true },
	state: { start: 106, length: 2 },
	postalCode: { start: 108, length: 10 },
	country: { start: 118, length: 3 },
	phone: { start: 121, length: 12 }
} as const;

export const C1 = {
	org: { start: 3, length: 1 },
	code: { start: 12, length: 6 },
	name: { start: 18, length: 30, truncate: true },
	shortName: { start: 48, length: 16, truncate: true },
	line1: { start: 64, length: 22, truncate: true },
	line2: { start: 86, length: 22, truncate: true },
	city: { start: 108, length: 20, truncate: true },
	state: { start: 128, length: 2 },
	postalCode: { start: 130, length: 10 },
	country: { start: 140, length: 3 },
	codeFifth: { start: 150, length: 1 }
} as const;

export const C2 = {
	org: { start: 3, length: 1 },
	code: { start: 12, length: 6 },
	coach: { start: 18, length: 30, truncate: true },
	phone: { start: 48, length: 12 },
	individualEntries: { start: 60, length: 6, align: 'right' },
	athletes: { start: 66, length: 6, align: 'right' },
	relayEntries: { start: 72, length: 5, align: 'right' },
	relaySwimmers: { start: 77, length: 6, align: 'right' },
	splits: { start: 83, length: 6, align: 'right' },
	shortName: { start: 89, length: 16, truncate: true },
	codeFifth: { start: 150, length: 1 }
} as const;

export const D0 = {
	org: { start: 3, length: 1 },
	name: { start: 12, length: 28, truncate: true },
	uss: { start: 40, length: 12 },
	attach: { start: 52, length: 1 },
	citizen: { start: 53, length: 3 },
	birth: { start: 56, length: 8 },
	age: { start: 64, length: 2, align: 'numeric' },
	sex: { start: 66, length: 1 },
	eventSex: { start: 67, length: 1 },
	distance: { start: 68, length: 4, align: 'right' },
	stroke: { start: 72, length: 1 },
	eventNumber: { start: 73, length: 4, align: 'numeric' },
	eventAge: { start: 77, length: 4 },
	swimDate: { start: 81, length: 8 },
	seed: { start: 89, length: 8 },
	seedCourse: { start: 97, length: 1 }
} as const;

export const D3 = {
	ussNew: { start: 3, length: 14 },
	preferredName: { start: 17, length: 15, truncate: true }
} as const;

export const E0 = {
	org: { start: 3, length: 1 },
	letter: { start: 12, length: 1 },
	team: { start: 13, length: 6 },
	legCount: { start: 19, length: 2, align: 'right' },
	eventSex: { start: 21, length: 1 },
	distance: { start: 22, length: 4, align: 'right' },
	stroke: { start: 26, length: 1 },
	eventNumber: { start: 27, length: 4, align: 'numeric' },
	eventAge: { start: 31, length: 4 },
	swimDate: { start: 38, length: 8 },
	seed: { start: 46, length: 8 },
	seedCourse: { start: 54, length: 1 }
} as const;

export const F0 = {
	org: { start: 3, length: 1 },
	team: { start: 16, length: 6 },
	letter: { start: 22, length: 1 },
	name: { start: 23, length: 28, truncate: true },
	uss: { start: 51, length: 12 },
	citizen: { start: 63, length: 3 },
	birth: { start: 66, length: 8 },
	age: { start: 74, length: 2, align: 'numeric' },
	sex: { start: 76, length: 1 },
	prelimLeg: { start: 77, length: 1 },
	swimoffLeg: { start: 78, length: 1 },
	finalLeg: { start: 79, length: 1 },
	ussNew: { start: 93, length: 14 },
	preferredName: { start: 107, length: 15, truncate: true }
} as const;

export const Z0 = {
	org: { start: 3, length: 1 },
	fileCode: { start: 12, length: 2 },
	bRecords: { start: 44, length: 3, align: 'right' },
	meets: { start: 47, length: 3, align: 'right' },
	cRecords: { start: 50, length: 4, align: 'right' },
	teams: { start: 54, length: 4, align: 'right' },
	dRecords: { start: 58, length: 6, align: 'right' },
	swimmers: { start: 64, length: 6, align: 'right' },
	eRecords: { start: 70, length: 5, align: 'right' },
	fRecords: { start: 75, length: 6, align: 'right' },
	gRecords: { start: 81, length: 6, align: 'right' }
} as const;
