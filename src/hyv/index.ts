import type { FormatDescriptor } from '../core/types.js';

export const FORMAT: FormatDescriptor = {
	name: 'Hy-Tek HYV',
	extensions: ['.hyv'],
	read: true,
	write: false
};

export { readHyv } from './read.js';
export type { SetupReadOptions } from '../core/types.js';
