import { toText } from '../core/text.js';
import type { FormatName, ReadResult } from '../core/types.js';
import { readEv3 } from '../ev3/read.js';
import { readHy3 } from '../hy3/read.js';
import { readHyv } from '../hyv/read.js';
import { readSdif } from '../sdif/read.js';
import { detectFormat } from './detect.js';
import { unzip, type UnzipOptions, type ZipEntry } from './unzip.js';

export interface MeetFile {
	readonly name: string;
	/** `null` when the file is not a recognised meet format. */
	readonly format: FormatName | null;
	readonly result?: ReadResult;
	readonly error?: string;
}

const READERS: Readonly<Record<FormatName, (text: string) => ReadResult>> = {
	sdif: readSdif,
	hy3: (text) => readHy3(text),
	ev3: (text) => readEv3(text),
	hyv: (text) => readHyv(text)
};

/** Reads caller-supplied files, detecting each one's format; one bad file never fails the rest. */
export function readMeetFiles(files: readonly ZipEntry[]): MeetFile[] {
	return files.map(({ name, bytes }) => {
		const text = toText(bytes);
		const format = detectFormat(text, name);
		if (!format) return { name, format };
		try {
			return { name, format, result: READERS[format](text) };
		} catch (error) {
			return { name, format, error: error instanceof Error ? error.message : String(error) };
		}
	});
}

export async function readMeetArchive(
	bytes: Uint8Array,
	options: UnzipOptions = {}
): Promise<MeetFile[]> {
	return readMeetFiles(await unzip(bytes, options));
}
