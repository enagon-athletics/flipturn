/** Base class for errors flipturn throws; `code` identifies which reader or writer raised it. */
export class FlipturnError extends Error {
	constructor(
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = new.target.name;
	}
}

export class SdifReadError extends FlipturnError {
	constructor(message: string) {
		super('sdif-read', message);
	}
}

export class SdifWriteError extends FlipturnError {
	constructor(readonly issues: readonly string[]) {
		super('sdif-write', `SDIF entries file is invalid: ${issues.join('; ')}`);
	}
}

export class Hy3ReadError extends FlipturnError {
	constructor(message: string) {
		super('hy3-read', message);
	}
}

export class EventFileReadError extends FlipturnError {
	constructor(message: string) {
		super('event-file-read', message);
	}
}

export class ZipReadError extends FlipturnError {
	constructor(message: string) {
		super('zip-read', message);
	}
}
