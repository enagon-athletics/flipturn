# Contributing

Issues and PRs welcome.

## Ground rules

- PRs, not direct commits to `main`.
- Conventional Commits. `commitlint` runs on `commit-msg`.
- `prettier` and `eslint` run on `pre-commit` via `lint-staged`.
- Tests must pass in CI before merge.

## Commit format

```
<type>(<optional scope>): <subject>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

```
feat(sdif): add SD3 header record reader
fix(core): handle single-digit fractional seconds
docs: add porting policy
```

## Local setup

```bash
mise install
bun install
bun run build
```

## Style

TypeScript strict mode. Tabs for indentation (see `.editorconfig`). Comments stay under
10% of added lines; anything longer belongs in the commit or `docs/`.

## Release model

One branch (`main`). Conventional-commit pushes accumulate into a release-please PR;
merging it tags a release and publishes to npm via `.github/workflows/release.yml`,
registered as this package's trusted publisher on npmjs.com. Every PR and push to `main`
also publishes a preview build via [pkg-pr-new](https://github.com/stackblitz-labs/pkg.pr.new) —
no version bump, no dist-tag, no manifest ceremony.

### Breaking changes

Pre-1.0, breaking changes bump the minor (not major), per
`bump-minor-pre-major: true` in `release-please-config.json`. Flag them with
`BREAKING CHANGE:` in the commit body:

```
feat(sdif)!: rename readSd3 to readSdif

BREAKING CHANGE: readSd3 is now readSdif; the CL2 extension is handled the same way.
```

## Porting from prior art

Some readers and writer design are ported from swimparse and swimlib. See
[`docs/porting-policy.md`](../docs/porting-policy.md) before porting anything new —
in particular, swimlib's D-series contact/registration records are off-limits (GPL
lineage).

## Security

See [`SECURITY.md`](SECURITY.md).
