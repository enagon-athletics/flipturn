import type { FormatDescriptor } from '../core/types.js';

export const FORMAT: FormatDescriptor = {
	name: 'SDIF v3',
	extensions: ['.sd3', '.cl2'],
	read: true,
	write: true
};

export { readSdif } from './read.js';
export { SdifWriteError, writeSdifEntries } from './write.js';
export type { SdifWriteOptions, SdifWriteResult } from './write.js';
