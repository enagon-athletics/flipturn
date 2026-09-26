import type { FormatDescriptor } from '../core/types.js';

export const FORMAT: FormatDescriptor = {
	name: 'SDIF v3',
	extensions: ['.sd3', '.cl2'],
	read: true,
	write: false
};

export { readSdif } from './read.js';
