import type { FormatDescriptor } from '../core/types.js';

export const FORMAT: FormatDescriptor = {
	name: 'Hy-Tek HY3',
	extensions: ['.hy3'],
	read: true,
	write: false
};

export { hy3Checksum } from './checksum.js';
export { readHy3 } from './read.js';
export type { Hy3ReadOptions } from './read.js';
export { Hy3ReadError } from '../core/errors.js';
