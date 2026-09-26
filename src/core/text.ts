import type { ReaderInput } from './types.js';

const HIGH_BLOCK: readonly (string | undefined)[] = [
	'€',
	undefined,
	'‚',
	'ƒ',
	'„',
	'…',
	'†',
	'‡',
	'ˆ',
	'‰',
	'Š',
	'‹',
	'Œ',
	undefined,
	'Ž',
	undefined,
	undefined,
	'‘',
	'’',
	'“',
	'”',
	'•',
	'–',
	'—',
	'˜',
	'™',
	'š',
	'›',
	'œ',
	undefined,
	'ž',
	'Ÿ'
];

const ENCODE_HIGH = new Map<string, number>(
	HIGH_BLOCK.flatMap((ch, i) => (ch === undefined ? [] : [[ch, 0x80 + i] as const]))
);

export function decodeWindows1252(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) {
		out += (b >= 0x80 && b <= 0x9f && HIGH_BLOCK[b - 0x80]) || String.fromCharCode(b);
	}
	return out;
}

export function encodeWindows1252(text: string): Uint8Array {
	const out = new Uint8Array(text.length);
	let i = 0;
	for (const ch of text) {
		const code = ENCODE_HIGH.get(ch) ?? ch.codePointAt(0) ?? 0;
		if (code > 0xff || (code >= 0x80 && code <= 0x9f && !ENCODE_HIGH.has(ch))) {
			throw new RangeError(`Character ${JSON.stringify(ch)} is not representable in Windows-1252`);
		}
		out[i++] = code;
	}
	return out.subarray(0, i);
}

/** Text as given; bytes as Windows-1252 unless they carry a UTF-8 byte-order mark. */
export function toText(input: ReaderInput): string {
	if (typeof input === 'string') return input;
	if (input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
		return new TextDecoder('utf-8').decode(input.subarray(3));
	}
	return decodeWindows1252(input);
}
