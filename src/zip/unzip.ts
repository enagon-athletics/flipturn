export interface ZipEntry {
	readonly name: string;
	readonly bytes: Uint8Array;
}

export interface UnzipOptions {
	/** Largest uncompressed entry accepted, guarding against zip bombs. Defaults to 64 MiB. */
	readonly maxEntryBytes?: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

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

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEndOfCentralDirectory(view: DataView): number {
	const earliest = Math.max(0, view.byteLength - 0xffff - 22);
	for (let at = view.byteLength - 22; at >= earliest; at--) {
		if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
	}
	throw new Error('Not a zip archive');
}

/** Lists and extracts a zip archive's files, using the platform's `DecompressionStream`. */
export async function unzip(bytes: Uint8Array, options: UnzipOptions = {}): Promise<ZipEntry[]> {
	const limit = options.maxEntryBytes ?? 64 * 1024 * 1024;
	if (bytes.byteLength < 22) throw new Error('Not a zip archive');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(view);
	const count = view.getUint16(eocd + 10, true);
	let at = view.getUint32(eocd + 16, true);
	if (at === 0xffffffff) throw new Error('Zip64 archives are not supported');

	const entries: ZipEntry[] = [];
	for (let i = 0; i < count; i++) {
		if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) throw new Error('Corrupt zip directory');
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
		if (flags & 0x1) throw new Error(`${name} is encrypted`);
		if (size > limit) throw new Error(`${name} is larger than ${limit} bytes`);
		if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
			throw new Error(`Corrupt local header for ${name}`);
		}
		const dataStart =
			localOffset +
			30 +
			view.getUint16(localOffset + 26, true) +
			view.getUint16(localOffset + 28, true);
		const data = bytes.subarray(dataStart, dataStart + compressedSize);

		let content: Uint8Array;
		if (method === 0) content = data.slice();
		else if (method === 8) content = await inflateRaw(data);
		else throw new Error(`${name} uses unsupported compression method ${method}`);
		if (content.length !== size || crc32(content) !== crc)
			throw new Error(`CRC mismatch in ${name}`);
		entries.push({ name, bytes: content });
	}
	return entries;
}
