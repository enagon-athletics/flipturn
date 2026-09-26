# Changelog

## [0.2.0](https://github.com/enagon-athletics/flipturn/compare/v0.1.0...v0.2.0) (2026-09-26)


### Features

* ship typescript sources with declaration maps ([a71fc45](https://github.com/enagon-athletics/flipturn/commit/a71fc45eaa4186bd1b1e157257d179448fe47f9e))


### Build

* develop on node 26 and smoke-test node 22, 24 and 26 in ci ([01edbd4](https://github.com/enagon-athletics/flipturn/commit/01edbd420026c12ef3e5c6f8909b9d9ae5e5488d))
* leave release-please generated files to release-please ([f617665](https://github.com/enagon-athletics/flipturn/commit/f6176658cbe433241e9bc83c5085642fa4026267))


### CI

* publish preview packages only from the public repo ([b5c1959](https://github.com/enagon-athletics/flipturn/commit/b5c195946d02a1add5598303e64a6da3b0fafca0))

## 0.1.0 (2026-09-26)

### Features

- **core:** format-neutral meet model, swim time codecs and a `FlipturnError` hierarchy
- **sdif:** read `.sd3` and `.cl2` files; write standard SDIF v3 entries files (Canadian mode)
- **hy3:** read `.hy3` files and verify line checksums
- **ev3, hyv:** read Hy-Tek meet event files
- **zip:** read zipped meet files with streaming size caps and no runtime dependencies
