export type SwimTime =
	| { readonly kind: 'time'; readonly hundredths: number }
	| { readonly kind: 'nt' }
	| { readonly kind: 'ns' }
	| { readonly kind: 'dq' };

const NON_TIME_CODES: ReadonlySet<string> = new Set(['NT', 'NS', 'DQ']);

const TIME_PATTERN = /^(?:(\d+):)?(\d{1,2})\.(\d{1,2})$/;

const SECONDS_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function parseSwimTime(input: string): SwimTime {
	const trimmed = input.trim().toUpperCase();

	if (NON_TIME_CODES.has(trimmed)) {
		return { kind: trimmed.toLowerCase() as 'nt' | 'ns' | 'dq' };
	}

	const match = TIME_PATTERN.exec(trimmed);
	if (!match) {
		throw new Error(`Invalid swim time: "${input}"`);
	}

	const [, minutesPart, secondsPart, fractionPart] = match as unknown as [
		string,
		string | undefined,
		string,
		string
	];
	const minutes = minutesPart ? Number.parseInt(minutesPart, 10) : 0;
	const seconds = Number.parseInt(secondsPart, 10);
	if (minutesPart !== undefined && seconds >= 60) {
		throw new Error(`Invalid swim time: "${input}"`);
	}
	const hundredths = Number.parseInt(fractionPart.padEnd(2, '0'), 10);

	return { kind: 'time', hundredths: minutes * 6000 + seconds * 100 + hundredths };
}

/** Reads a raw-seconds time (`138.08`), as Hy-Tek writes them; `null` if not a positive time. */
export function swimTimeFromSeconds(input: string): SwimTime | null {
	const trimmed = input.trim();
	if (!SECONDS_PATTERN.test(trimmed)) return null;
	const [whole = '0', fraction = ''] = trimmed.split('.');
	const hundredths =
		Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10);
	return hundredths > 0 ? { kind: 'time', hundredths } : null;
}

export function formatSwimTime(time: SwimTime): string {
	if (time.kind !== 'time') {
		return time.kind.toUpperCase();
	}

	const minutes = Math.floor(time.hundredths / 6000);
	const seconds = Math.floor((time.hundredths % 6000) / 100);
	const hundredths = time.hundredths % 100;
	const secondsPart = `${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;

	return minutes > 0 ? `${minutes}:${secondsPart}` : secondsPart;
}
