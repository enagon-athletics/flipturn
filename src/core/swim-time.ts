export type SwimTime =
	| { readonly kind: 'time'; readonly hundredths: number }
	| { readonly kind: 'nt' }
	| { readonly kind: 'ns' }
	| { readonly kind: 'dq' };

const NON_TIME_CODES: ReadonlySet<string> = new Set(['NT', 'NS', 'DQ']);

const TIME_PATTERN = /^(?:(\d+):)?(\d{1,2})\.(\d{1,2})$/;

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
	const hundredths = Number.parseInt(fractionPart.padEnd(2, '0'), 10);

	return { kind: 'time', hundredths: minutes * 6000 + seconds * 100 + hundredths };
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
