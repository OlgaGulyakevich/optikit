# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(while on `0.x`, a change to existing behaviour bumps the minor).

## [0.3.0] — 2026-09-21

### Security

- **`optikit svg` now removes executable content by default** — `<script>` elements,
  `on*` event handlers and `javascript:` links. svgo does not do this on its own, so
  until now they passed straight through into files usually destined for a web page,
  where an inline `<script>` runs with the page's origin. Every affected file is named
  in the output; nothing is removed silently.
  This is a safe default, **not a sanitizer** — for SVG from an untrusted source,
  sanitize properly (e.g. DOMPurify) before putting it on a page.

### Added

- `--keep-scripts` flag for `optikit svg`, to keep interactive or animated SVGs intact.

### Changed

- `optikit svg` no longer stops the whole batch when one file fails to parse. The bad
  file is reported and skipped, the rest of the batch still runs, and the command exits
  non-zero so CI notices. Previously a single unparseable icon ended the run, leaving
  the remaining files silently untouched.
- Parse errors now name the file. svgo reports positions against a literal `<input>`
  placeholder, which said nothing about *which* of fifty icons was at fault.

### Fixed

- A stripped script could reappear in the output: the keep-smaller step copies the
  original back when optimization does not shrink the file, which would have undone
  the removal. Outputs whose content was altered for safety are now left alone.

- `optikit favicon` surfaces the same warning when it strips content from an SVG source.

### Dependencies

- `sharp` 0.35.2 → 0.35.4 and `svgo` 4.0.1 → 4.1.0, closing two high-severity
  advisories in the dependency tree. No vulnerabilities remain in runtime or dev
  dependencies.

## [0.2.0] — 2026-07-03

### Added

- `trim` command — crops transparent padding from PNG and WebP, with `--threshold`.
- CI workflow and package metadata (repository, homepage, bugs).

### Fixed

- `bin` path in `package.json` no longer carries a leading slash.

## [0.1.0] — 2026-06-24

### Added

- First release: `img` (WebP/AVIF, `@1x`/`@2x`), `og` (1200×630 covers),
  `video convert` / `video compress` (ffmpeg → mp4, `--max`), `svg` (svgo) and
  `favicon` (full set + `.ico` + manifest + `<link>` snippet).

[0.3.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.3.0
[0.2.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.2.0
[0.1.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.1.0
