import type { FormatDescriptor } from '../core/types.js';

export const FORMAT: FormatDescriptor = {
	name: 'Hy-Tek EV3',
	extensions: ['.ev3'],
	read: true,
	write: false
};

export { readEv3 } from './read.js';
export type { SetupReadOptions } from '../core/types.js';
