# flipturn

Read and write swim meet files (SDIF, Hy-Tek .hy3/.ev3/.hyv) in TypeScript.

MIT-licensed, zero-runtime-dependency, ESM. Runs on Node >=22, Bun, and browsers.

## Install

```bash
npm install @enagonathletics/flipturn
```

## Status

Pre-1.0. The API is unstable and will change without a major version bump (see
`bump-minor-pre-major` in `release-please-config.json`). Only `core`'s `SwimTime`
parse/format helpers are implemented; every format module is a stub.

## Formats

| Format              | Extensions     | Read    | Write   |
| ------------------- | -------------- | ------- | ------- |
| SDIF v3             | `.sd3`, `.cl2` | planned | planned |
| Hy-Tek meet results | `.hy3`         | planned | planned |
| Hy-Tek event files  | `.ev3`, `.hyv` | planned | planned |
| Lenex               | `.lef`, `.lxf` | planned | planned |

## Usage

```ts
import { parseSwimTime, formatSwimTime } from '@enagonathletics/flipturn/core';

const time = parseSwimTime('1:02.34'); // { kind: 'time', hundredths: 6234 }
formatSwimTime(time); // '1:02.34'

parseSwimTime('DQ'); // { kind: 'dq' }
```

## Docs

- [Porting policy](docs/porting-policy.md) — what's ported from prior art and what
  isn't.
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

MIT © Enagon Athletics
