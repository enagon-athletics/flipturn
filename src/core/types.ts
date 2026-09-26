import type { SwimTime } from './swim-time.js';

export type Course = 'SCM' | 'SCY' | 'LCM';

/** `MEDLEY` is the medley relay; an individual medley is `IM`. */
export type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM' | 'MEDLEY';

export type Gender = 'M' | 'F' | 'X';

/** Event sex exactly as the file states it: G/B are age-group, W/M senior. */
export type SexCode = 'M' | 'F' | 'X' | 'G' | 'B' | 'W';

export type EventType = 'individual' | 'relay';

export type Round = 'prelim' | 'swimoff' | 'final';

export type ResultStatus = 'ok' | 'dq' | 'ns' | 'dnf' | 'scratch' | 'exhibition';

/** Inclusive age limits; `null` means unbounded on that side. */
export interface AgeBand {
	readonly min: number | null;
	readonly max: number | null;
}

export interface Address {
	readonly line1?: string;
	readonly line2?: string;
	readonly city?: string;
	readonly state?: string;
	readonly postalCode?: string;
	readonly country?: string;
}

/** An identifier a file carries for a swimmer, tagged with where it came from. */
export interface ExternalId {
	readonly system: ExternalIdSystem;
	readonly value: string;
}

export type ExternalIdSystem =
	'sdif:uss' | 'sdif:uss-new' | 'hy3:registration' | 'hy3:athlete-number';

export interface Swimmer {
	readonly id: string;
	readonly lastName: string;
	readonly firstName: string;
	readonly middleInitial?: string;
	readonly preferredName?: string;
	readonly gender?: 'M' | 'F';
	/** ISO `YYYY-MM-DD`. */
	readonly birthDate?: string;
	readonly age?: number;
	readonly teamCode?: string;
	/** Country code, e.g. `CAN`. */
	readonly citizenship?: string;
	readonly attached?: boolean;
	readonly externalIds: readonly ExternalId[];
}

export interface Coach {
	readonly name: string;
	readonly phone?: string;
}

export interface Team {
	readonly code: string;
	readonly name: string;
	readonly shortName?: string;
	readonly address?: Address;
	readonly coach?: Coach;
}

export interface QualifyingTimes {
	readonly LCM?: SwimTime;
	readonly SCM?: SwimTime;
	readonly SCY?: SwimTime;
}

export interface MeetEvent {
	/** Unique within a meet; entries reference events by this. */
	readonly id: string;
	/** As printed, suffix included (`3A`); empty when the file has none. */
	readonly number: string;
	readonly type: EventType;
	readonly gender: Gender;
	readonly sexCode: SexCode;
	readonly distance: number;
	readonly stroke: Stroke;
	readonly course?: Course;
	readonly ageBand: AgeBand;
	/** ISO date the event is swum, when known. */
	readonly date?: string;
	readonly prelimsFinals?: boolean;
	readonly rounds?: number;
	readonly relayLegs?: number;
	readonly entryFee?: number;
	readonly qualifyingTimes?: QualifyingTimes;
	readonly sessionId?: string;
	readonly sessionOrder?: number;
}

export interface Session {
	readonly id: string;
	readonly day?: number;
	/** 24-hour `HH:MM`. */
	readonly startTime?: string;
	readonly eventCount: number;
}

export interface Result {
	readonly round: Round;
	/** `null` when the round was swum but no time was recorded. */
	readonly time: SwimTime | null;
	readonly status: ResultStatus;
	readonly place?: number;
	readonly heat?: number;
	readonly lane?: number;
	readonly points?: number;
	/** Cumulative split times in hundredths. */
	readonly splits?: readonly number[];
	readonly splitDistance?: number;
	readonly dqCode?: string;
	readonly dqReason?: string;
}

export interface IndividualEntry {
	readonly kind: 'individual';
	readonly eventId: string;
	readonly swimmerId: string;
	readonly teamCode?: string;
	readonly seedTime?: SwimTime;
	readonly seedCourse?: Course;
	readonly results: readonly Result[];
}

export interface RelayLeg {
	readonly swimmerId?: string;
	/** `Last, First` as the file prints it. */
	readonly name: string;
	/** 1-4, or `alternate`. */
	readonly order: number | 'alternate';
	readonly legTime?: SwimTime;
}

export interface RelayEntry {
	readonly kind: 'relay';
	readonly eventId: string;
	readonly teamCode: string;
	readonly relayLetter: string;
	readonly seedTime?: SwimTime;
	readonly seedCourse?: Course;
	readonly results: readonly Result[];
	readonly legs: readonly RelayLeg[];
}

export type Entry = IndividualEntry | RelayEntry;

export interface MeetHost {
	readonly name: string;
	readonly address?: Address;
	readonly phone?: string;
}

export interface Meet {
	readonly name: string;
	/** ISO `YYYY-MM-DD`. */
	readonly startDate?: string;
	readonly endDate?: string;
	readonly ageUpDate?: string;
	readonly entryDeadline?: string;
	readonly course?: Course;
	/** SDIF MEET Code 005 (`1` invitational, `9` dual, ...). */
	readonly meetType?: string;
	readonly sanction?: string;
	readonly address?: Address;
	readonly host?: MeetHost;
	readonly teams: readonly Team[];
	readonly swimmers: readonly Swimmer[];
	readonly events: readonly MeetEvent[];
	readonly entries: readonly Entry[];
	readonly sessions: readonly Session[];
}

/** One line of the source file, kept verbatim for callers that need more than the model. */
export interface RawRecord {
	readonly code: string;
	/** 1-based line number. */
	readonly line: number;
	readonly text: string;
}

export interface FileSource {
	readonly software?: string;
	readonly version?: string;
	readonly createdAt?: string;
}

export type FormatName = 'sdif' | 'hy3' | 'ev3' | 'hyv';

export interface ReadResult<F extends FormatName = FormatName> {
	readonly format: F;
	readonly source: FileSource;
	readonly meet: Meet;
	readonly records: readonly RawRecord[];
	readonly warnings: readonly string[];
}

/** Anything a reader accepts: text, or raw bytes decoded as Windows-1252. */
export type ReaderInput = string | Uint8Array;

export interface FormatDescriptor {
	readonly name: string;
	readonly extensions: readonly string[];
	readonly read: boolean;
	readonly write: boolean;
}

export interface SetupReadOptions {
	/** `null` drops unset-date sentinels and sub-second placeholder cuts. Defaults to `keep`. */
	readonly placeholders?: 'keep' | 'null';
}
