// Builds byte-exact zip archives for tests, including ones with a dishonest size field.
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntrySpec {
	readonly name: string;
	readonly data: Uint8Array;
	/** Defaults to 8 (deflate); use 0 for stored. */
	readonly method?: 0 | 8;
	/** Overrides the uncompressed-size field in both headers, to simulate a lying archive. */
	readonly declaredSize?: number;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

interface Part {
	readonly local: Uint8Array;
	readonly data: Uint8Array;
	readonly central: Uint8Array;
}

function record(entry: ZipEntrySpec): Part {
	const method = entry.method ?? 8;
	const stored = method === 0 ? entry.data : deflateRawSync(entry.data);
	const size = entry.declaredSize ?? entry.data.length;
	const crc = crc32(entry.data);
	const name = new TextEncoder().encode(entry.name);

	const local = new Uint8Array(30 + name.length);
	const lv = new DataView(local.buffer);
	lv.setUint32(0, LOCAL_SIGNATURE, true);
	lv.setUint16(8, method, true);
	lv.setUint32(14, crc, true);
	lv.setUint32(18, stored.length, true);
	lv.setUint32(22, size, true);
	lv.setUint16(26, name.length, true);
	local.set(name, 30);

	const central = new Uint8Array(46 + name.length);
	const cv = new DataView(central.buffer);
	cv.setUint32(0, CENTRAL_SIGNATURE, true);
	cv.setUint16(10, method, true);
	cv.setUint32(16, crc, true);
	cv.setUint32(20, stored.length, true);
	cv.setUint32(24, size, true);
	cv.setUint16(28, name.length, true);
	central.set(name, 46);

	return { local, data: stored, central };
}

/** Assembles a minimal single-disk zip; an entry's `declaredSize` need not match its real size. */
export function buildZip(entries: readonly ZipEntrySpec[]): Uint8Array {
	const parts = entries.map(record);
	const chunks: Uint8Array[] = [];
	const localOffsets: number[] = [];
	let offset = 0;
	for (const part of parts) {
		localOffsets.push(offset);
		chunks.push(part.local, part.data);
		offset += part.local.length + part.data.length;
	}
	const centralStart = offset;
	parts.forEach((part, i) => {
		new DataView(part.central.buffer).setUint32(42, localOffsets[i] ?? 0, true);
		chunks.push(part.central);
		offset += part.central.length;
	});
	const centralSize = offset - centralStart;

	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, EOCD_SIGNATURE, true);
	ev.setUint16(8, entries.length, true);
	ev.setUint16(10, entries.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, centralStart, true);
	chunks.push(eocd);

	const total = chunks.reduce((n, c) => n + c.length, 0);
	const out = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.length;
	}
	return out;
}
