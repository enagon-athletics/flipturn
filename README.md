# flipturn

Read and write swim meet files (SDIF, Hy-Tek .hy3/.ev3/.hyv) in TypeScript.

MIT-licensed, zero-runtime-dependency, ESM. Runs on Node >=22, Bun, and browsers. Library code
never touches the file system: pass it text or bytes.

## Install

```bash
npm install @enagonathletics/flipturn
```

## Status

Pre-1.0. The API is unstable and will change without a major version bump (see
`bump-minor-pre-major` in `release-please-config.json`).

## Formats

| Format              | Extensions     | Read                                                 | Write                        |
| ------------------- | -------------- | ---------------------------------------------------- | ---------------------------- |
| SDIF v3             | `.sd3`, `.cl2` | Yes: meet, teams, swimmers, entries, results, splits | Yes: entries (standard SDIF) |
| Hy-Tek meet results | `.hy3`         | Yes: entries, results per round, relays, DQ reasons  | No                           |
| Hy-Tek event files  | `.ev3`, `.hyv` | Yes: events, sessions, fees, qualifying times        | No                           |
| Zip containers      | `.zip`         | Yes: detects and reads each meet file inside         | No                           |
| Lenex               | `.lef`, `.lxf` | No                                                   | No                           |

Every reader returns the same format-neutral `Meet` model plus the file's raw records and
any warnings. Known gaps: HY3 split records (G1) are not read, and Team Unify's "Extended"
SD3 variant is not written until a real sample has been compared.

## Usage

Read any meet file:

```ts
import { readSdif } from '@enagonathletics/flipturn/sdif';

const { meet, warnings } = readSdif(bytes); // Uint8Array (Windows-1252) or string
meet.swimmers; // name, birth date, gender, external ids
meet.entries; // seed times and, for results files, one result per round
```

Read every meet file in a Meet Manager zip:

```ts
import { readMeetArchive } from '@enagonathletics/flipturn/zip';

for (const file of await readMeetArchive(zipBytes)) {
	if (file.result) console.log(file.name, file.format, file.result.meet.events.length);
	else if (file.error) console.warn(file.name, file.error);
}
```

Event files keep the sex code as written (`G`/`B` age-group, `W`/`M` senior) next to the
canonical gender:

```ts
import { readEv3 } from '@enagonathletics/flipturn/ev3';

const [event] = readEv3(text).meet.events;
event.sexCode; // 'G'
event.gender; // 'F'
```

Write an SDIF entries file. `canadian` mode makes the USA Swimming ID optional:

```ts
import { encodeWindows1252 } from '@enagonathletics/flipturn/core';
import { writeSdifEntries } from '@enagonathletics/flipturn/sdif';

const { text, warnings } = writeSdifEntries(meet, {
	mode: 'canadian',
	contact: { name: 'Registrar, Lee', phone: '2505550199' }
});
const bytes = encodeWindows1252(text); // 160-byte records, CRLF line endings
```

Swim times are integers in hundredths:

```ts
import { formatSwimTime, parseSwimTime } from '@enagonathletics/flipturn/core';

parseSwimTime('1:02.34'); // { kind: 'time', hundredths: 6234 }
formatSwimTime({ kind: 'nt' }); // 'NT'
```

## Docs

- [Porting policy](docs/porting-policy.md): what's ported from prior art and what isn't.
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

MIT © Enagon Athletics
