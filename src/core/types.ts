export type Course = 'SCM' | 'SCY' | 'LCM';

export type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM';

export type Gender = 'M' | 'F' | 'X';

export interface Athlete {
	readonly firstName: string;
	readonly lastName: string;
	readonly gender: Gender;
	readonly birthDate?: string;
}

export interface MeetEvent {
	readonly number: number;
	readonly stroke: Stroke;
	readonly distanceMeters: number;
	readonly course: Course;
	readonly gender: Gender;
}

export interface FormatDescriptor {
	readonly name: string;
	readonly extensions: readonly string[];
	readonly read: boolean;
	readonly write: boolean;
}
