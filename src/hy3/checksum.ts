// Ported from https://github.com/dmanusrex/swimlib @ c3dd473 (MIT).
const CONTENT_LENGTH = 128;

/** Checksum of an HY3 line: even columns weigh 1, odd 2; floor(sum / 21) + 205, last two digits reversed. */
export function hy3Checksum(line: string): string {
	const content = line.slice(0, CONTENT_LENGTH);
	let sum = 0;
	for (let i = 0; i < content.length; i++) {
		sum += content.charCodeAt(i) * (i % 2 === 0 ? 1 : 2);
	}
	const lastTwo = String((Math.floor(sum / 21) + 205) % 100).padStart(2, '0');
	return `${lastTwo[1]}${lastTwo[0]}`;
}
