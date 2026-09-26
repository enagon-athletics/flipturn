import { readFileSync } from 'node:fs';
import { readMeetArchive, readSdif } from '@enagonathletics/flipturn';

const fixture = (path) =>
	new Uint8Array(readFileSync(new URL(`../fixtures/${path}`, import.meta.url)));

const results = readSdif(fixture('sdif/results.sd3'));
if (results.meet.teams.length === 0) throw new Error('readSdif returned no teams');

const archive = await readMeetArchive(fixture('zip/results.zip'));
if (archive.length === 0) throw new Error('readMeetArchive returned no files');

console.log(`node ${process.version}: ok`);
