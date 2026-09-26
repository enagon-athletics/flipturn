import { ZipReadError } from '../core/errors.js';

export interface ZipEntry {
	readonly name: string;
	readonly bytes: Uint8Array;
}

export interface UnzipOptions {
	/** Largest uncompressed entry accepted, guarding against zip bombs. Defaults to 64 MiB. */
	readonly maxEntryBytes?: number;
	/** Largest total uncompressed bytes across every entry combined. Defaults to 512 MiB. */
	readonly maxTotalBytes?: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const DEFAULT_MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const b of bytes) crc = (CRC_TABLE[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** Decompresses one entry, cancelling the stream as soon as its output passes `cap` bytes. */
async function inflateRaw(bytes: Uint8Array, cap: number, name: string): Promise<Uint8Array> {
	const reader = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'))
		.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > cap) {
				await reader.cancel();
				throw new ZipReadError(`${name} decompresses past its ${cap}-byte cap`);
			}
			chunks.push(value);
		}
	} catch (error) {
		if (error instanceof ZipReadError) throw error;
		const message = error instanceof Error ? error.message : String(error);
		throw new ZipReadError(`${name} could not be decompressed: ${message}`);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

function findEndOfCentralDirectory(view: DataView): number {
	const earliest = Math.max(0, view.byteLength - 0xffff - 22);
	for (let at = view.byteLength - 22; at >= earliest; at--) {
		if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
	}
	throw new ZipReadError('Not a zip archive');
}

/** Lists and extracts a zip archive's files, using the platform's `DecompressionStream`. */
export async function unzip(bytes: Uint8Array, options: UnzipOptions = {}): Promise<ZipEntry[]> {
	const limit = options.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
	const totalLimit = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
	if (bytes.byteLength < 22) throw new ZipReadError('Not a zip archive');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(view);
	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);
	if (at === 0xffffffff) throw new ZipReadError('Zip64 archives are not supported');

	const entries: ZipEntry[] = [];
	let totalBytes = 0;
	for (let i = 0; i < count; i++) {
		if (view.getUint32(at, true) !== CENTRAL_SIGNATURE)
			throw new ZipReadError('Corrupt zip directory');
		const flags = view.getUint16(at + 8, true);
		const method = view.getUint16(at + 10, true);
		const crc = view.getUint32(at + 16, true);
		const compressedSize = view.getUint32(at + 20, true);
		const size = view.getUint32(at + 24, true);
		const nameLength = view.getUint16(at + 28, true);
		const extraLength = view.getUint16(at + 30, true);
		const commentLength = view.getUint16(at + 32, true);
		const localOffset = view.getUint32(at + 42, true);
		const rawName = bytes.subarray(at + 46, at + 46 + nameLength);
		const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'latin1').decode(rawName);
		at += 46 + nameLength + extraLength + commentLength;

		if (name.endsWith('/')) continue;
		if (flags & 0x1) throw new ZipReadError(`${name} is encrypted`);
		if (size > limit) throw new ZipReadError(`${name} is larger than ${limit} bytes`);
		if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
			throw new ZipReadError(`Corrupt local header for ${name}`);
		}
		const dataStart =
			localOffset +
			30 +
			view.getUint16(localOffset + 26, true) +
			view.getUint16(localOffset + 28, true);
		const data = bytes.subarray(dataStart, dataStart + compressedSize);

		let content: Uint8Array;
		if (method === 0) content = data.slice();
		else if (method === 8) content = await inflateRaw(data, Math.min(size, limit), name);
		else throw new ZipReadError(`${name} uses unsupported compression method ${method}`);
		if (content.length !== size || crc32(content) !== crc)
			throw new ZipReadError(`CRC mismatch in ${name}`);

		totalBytes += content.length;
		if (totalBytes > totalLimit) {
			throw new ZipReadError(`archive exceeds the total decompressed cap of ${totalLimit} bytes`);
		}
		entries.push({ name, bytes: content });
	}
	return entries;
}
