# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(while on `0.x`, a change to existing behaviour bumps the minor).

## [0.5.0] — 2026-10-04

### Added

- `video poster` — a still frame per clip for `<video poster>`, as WebP. By default
  the whole clip is sampled in one decode pass and the sharpest well-exposed frame
  wins (the first frame is usually a fade or a blur). `--candidates <n>` writes `n`
  frames from across the clip plus a contact sheet with timecodes to pick from;
  `--at <time>` takes an exact moment.
- `--web-names` on every command that writes files (not `favicon`): output names
  become lowercase latin with no spaces or URL-breaking characters, from any
  language — Cyrillic, German (`ä → ae`), Czech, Polish, Nordic. Folders too;
  `@1x`/`@2x` kept. Both encodings of one letter give the same name. Two inputs that
  would collide stop the command before anything is written.

### Dependencies

- `@sindresorhus/transliterate` — transliteration with per-language rules, no
  dependencies of its own.

## [0.4.0] — 2026-10-03

### Fixed

- **Every mp4 from `video convert` and `video compress` is now faststart** — the index
  (`moov`) is written before the media data. Before, ffmpeg's default left it at the
  end, so a browser had to fetch the tail of the file before it could play, and each
  first play showed a loading spinner. With `--max`, the flag goes on the final pass.
- Invalid flags are reported one line per flag, named as typed
  (`✖ --quality: Too big: expected number to be <=100`), instead of a raw JSON dump.
- An absolute input path is printed as given. Before, it came out relative to the
  current directory, e.g. `../../../../private/tmp/…`.

### Added

- `video faststart` — moves the index to the front with a stream copy: no re-encode,
  no quality loss, seconds per clip. Each output is verified after writing.
- `video check` — reports whether each mp4/m4v/mov is faststart and exits non-zero if
  any is not, for CI and pre-build steps. Reads only atom headers; needs no ffmpeg.
- `icon audit` — finds icons whose ink is off the canvas centre (the eye centres mass,
  the browser centres the bounding box) and reports the gap in viewBox units and %.
  Report-only by default; `--fix` writes shifted copies with the translate baked into
  the paths by svgo and re-measures them. Options: `--amount full|half|<0–1>`,
  `--threshold <percent>`, `--same-as <file>` for state pairs.

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

[0.5.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.5.0
[0.4.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.4.0
[0.3.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.3.0
[0.2.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.2.0
[0.1.0]: https://github.com/OlgaGulyakevich/optikit/releases/tag/v0.1.0
