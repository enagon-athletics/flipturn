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

### Entry limits and fees

`Meet.entryLimits` and `Meet.fees` are meet-wide; `MeetEvent.entryFee` is per event and
`IndividualEntry`/`RelayEntry.entryFee` is per entry. A format only gets a field here when a
byte position for it was confirmed against a documented field table or a real exported file —
see [porting policy](docs/porting-policy.md) for the sources.

| Format | `entryLimits`                                                                                                                                                                                                                                                                 | Fee types                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| EV3    | `maxTotalEntries`, `maxIndividualEntries`, `maxRelayEntries` — meet-wide, per swimmer except the total (header fields 19–21, 1-based)                                                                                                                                         | `MeetEvent.entryFee` per event/relay (field 15), plus meet-wide `teamSurcharge`, `athleteSurcharge`, `facilitySurcharge` (header fields 7–9) |
| HYV    | None — confirmed absent. Team Manager's 11-field header and ~18-field event row have no unclaimed columns for one; cross-checked against `swimparse` and `hytek-parser`'s independent HYV readers, neither of which decodes anything beyond the existing per-event `entryFee` | `MeetEvent.entryFee` per event/relay only                                                                                                    |
| HY3    | None — confirmed absent. A results/entries format has no reason to carry them and none of `swimparse`, `swimlib` or `hytek-parser` decode any                                                                                                                                 | `IndividualEntry.entryFee` (E1, 1-based cols 33–38) and `RelayEntry.entryFee` (F1, same columns) only — no meet-wide fee field               |
| SDIF   | None — confirmed absent from the spec text itself (no field in `B1`/`B2`/`D0`/`D1`)                                                                                                                                                                                           | None — confirmed absent, same basis                                                                                                          |

Two candidates were investigated and deliberately **not** modeled:

- **EV3 event-row columns 27–29** (`max_entries`, `max_individual_entries`, `max_relay_entries`
  per `swimlib`'s field table) sit right after the per-event session columns, which would fit
  a per-day/session limit — but the one EV3 sample available repeats the same three values on
  every event regardless of day, which is equally consistent with "an event-level cap" as with
  "a per-day limit stated redundantly." Absent a real file where they vary by day, this is not
  asserted as the per-day limit the task asked for.
- **HY3 B2's `meetFee`** (`swimlib`'s claimed 1-based cols 100–106) does not survive a cross-check:
  `swimlib`'s own B1 date fields, in the same record family, land on garbage when checked against
  real Meet Manager results exports, while `swimparse` and `hytek-parser` — the two libraries
  whose B-record offsets _do_ reproduce the real dates in those files — neither decode a B2 fee
  at all. Treated as unconfirmed, not modeled.

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

Event numbers (digits right-justified in columns 73-75, a suffix letter in 76) and NT seeds
(right-justified) are laid out as Hy-Tek and Team Unify write them, and a team gets a C2 record
only when it has a coach. Pass `profile: 'team-unify'` to also fill the columns Team Unify's Standard SD3 export writes beyond the spec: an A0
description (`description`, default `Meet Entries`), B1 altitude (`Meet.altitude`, default 0),
the team code's LSC in D0 columns 4-11, D3 participation flags and `Swimmer.middleName`, and the
Z0 batch and membership counts.

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
