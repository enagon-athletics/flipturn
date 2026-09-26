# Porting policy

flipturn ports from two prior-art MIT projects rather than reimplementing every format
from a blank page. This page draws the line on what gets ported and what doesn't.

- **Readers** derive from [swimparse](https://github.com/g0rgonus/swimparse) (Dan
  Goergen, MIT) — its SDIF and HY3 parsing approach informs `src/sdif` and `src/hy3`.
- **Writer design and the HY3 checksum algorithm** derive from
  [swimlib](https://github.com/dmanusrex/swimlib) (Darren Richer, MIT). Some reader field
  positions (e.g. EV3 header entry limits/surcharges, HY3 E1/F1 entry fee) also come from
  swimlib's field tables when swimparse doesn't document that field itself; each such
  position was cross-checked against a real exported file before being trusted, since
  swimlib's own B-record (HY3 meet header) byte offsets have been found wrong against real
  files.
- **The SDIF writer** is implemented from the public SDIF v3 specification directly, not
  ported from either project.
- **Never port swimlib's contact/registration (D-series) record layouts.** They trace
  back to the GPL-licensed `wp-swimteam` WordPress plugin, and porting them would pull a
  GPL lineage into an MIT package.

Every file that ports logic from either project carries a one-line provenance header
naming the source repository and the commit it was ported from, e.g.:

```ts
// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
```

See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for the full license texts.
