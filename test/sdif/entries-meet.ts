import type { Meet } from '../../src/core/index.js';

/** A synthetic club entries file, shaped so the reader reproduces it exactly. */
export const entriesMeet: Meet = {
	name: 'Synthetic Fall Classic',
	startDate: '2026-10-17',
	endDate: '2026-10-18',
	course: 'SCM',
	meetType: '1',
	address: { city: 'Victoria', state: 'BC', country: 'CAN' },
	host: { name: 'Harbour Swim Club', phone: '2505550101' },
	teams: [
		{
			code: 'BCHSC',
			name: 'Harbour Swim Club',
			shortName: 'Harbour',
			address: { city: 'Victoria', state: 'BC', country: 'CAN' },
			coach: { name: 'Coach, Casey', phone: '2505550102' }
		}
	],
	swimmers: [
		{
			id: 'tern|ada|2012-03-14',
			lastName: 'Tern',
			firstName: 'Ada',
			middleInitial: 'M',
			preferredName: 'Addie',
			gender: 'F',
			birthDate: '2012-03-14',
			age: 14,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: [
				{ system: 'sdif:uss', value: '123456789' },
				{ system: 'sdif:uss-new', value: '123456789' }
			]
		},
		{
			id: 'petrel|ben|2010-07-02',
			lastName: 'Petrel',
			firstName: 'Ben',
			gender: 'M',
			birthDate: '2010-07-02',
			age: 16,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: []
		},
		{
			id: 'gannet|cleo|2012-11-30',
			lastName: 'Gannet',
			firstName: 'Cleo',
			gender: 'F',
			birthDate: '2012-11-30',
			age: 13,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: []
		},
		{
			id: 'skua|dana|2013-01-05',
			lastName: 'Skua',
			firstName: 'Dana',
			gender: 'F',
			birthDate: '2013-01-05',
			age: 13,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: []
		},
		{
			id: 'auk|emma|2012-06-21',
			lastName: 'Auk',
			firstName: 'Emma',
			gender: 'F',
			birthDate: '2012-06-21',
			age: 14,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: []
		},
		{
			id: 'loon|fay|2013-09-09',
			lastName: 'Loon',
			firstName: 'Fay',
			gender: 'F',
			birthDate: '2013-09-09',
			age: 13,
			teamCode: 'BCHSC',
			citizenship: 'CAN',
			attached: true,
			externalIds: []
		}
	],
	events: [
		{
			id: '12',
			number: '12',
			type: 'individual',
			gender: 'F',
			sexCode: 'F',
			distance: 100,
			stroke: 'FREE',
			course: 'SCM',
			ageBand: { min: 13, max: 14 }
		},
		{
			id: '3A',
			number: '3A',
			type: 'individual',
			gender: 'F',
			sexCode: 'F',
			distance: 50,
			stroke: 'FLY',
			course: 'SCM',
			ageBand: { min: null, max: 14 }
		},
		{
			id: '14',
			number: '14',
			type: 'individual',
			gender: 'M',
			sexCode: 'M',
			distance: 400,
			stroke: 'FREE',
			course: 'SCM',
			ageBand: { min: 15, max: null }
		},
		{
			id: '20',
			number: '20',
			type: 'relay',
			gender: 'F',
			sexCode: 'F',
			distance: 200,
			stroke: 'MEDLEY',
			course: 'SCM',
			ageBand: { min: 13, max: 14 }
		}
	],
	entries: [
		{
			kind: 'individual',
			eventId: '12',
			swimmerId: 'tern|ada|2012-03-14',
			teamCode: 'BCHSC',
			seedTime: { kind: 'time', hundredths: 6532 },
			seedCourse: 'SCM',
			results: []
		},
		{
			kind: 'individual',
			eventId: '3A',
			swimmerId: 'tern|ada|2012-03-14',
			teamCode: 'BCHSC',
			seedTime: { kind: 'nt' },
			seedCourse: 'SCM',
			results: []
		},
		{
			kind: 'individual',
			eventId: '14',
			swimmerId: 'petrel|ben|2010-07-02',
			teamCode: 'BCHSC',
			seedTime: { kind: 'time', hundredths: 29000 },
			seedCourse: 'SCY',
			results: []
		},
		{
			kind: 'relay',
			eventId: '20',
			teamCode: 'BCHSC',
			relayLetter: 'A',
			seedTime: { kind: 'time', hundredths: 14567 },
			seedCourse: 'SCM',
			results: [],
			legs: [
				{ swimmerId: 'gannet|cleo|2012-11-30', name: 'Gannet, Cleo', order: 1 },
				{ swimmerId: 'tern|ada|2012-03-14', name: 'Tern, Ada M', order: 2 },
				{ swimmerId: 'skua|dana|2013-01-05', name: 'Skua, Dana', order: 3 },
				{ swimmerId: 'auk|emma|2012-06-21', name: 'Auk, Emma', order: 4 },
				{ swimmerId: 'loon|fay|2013-09-09', name: 'Loon, Fay', order: 'alternate' }
			]
		}
	],
	sessions: []
};
