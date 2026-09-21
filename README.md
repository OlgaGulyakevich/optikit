# optikit

[![npm](https://img.shields.io/npm/v/@gulyakevich/optikit?logo=npm&color=0A7EA4)](https://www.npmjs.com/package/@gulyakevich/optikit)
[![CI](https://github.com/OlgaGulyakevich/optikit/actions/workflows/ci.yml/badge.svg)](https://github.com/OlgaGulyakevich/optikit/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License MIT](https://img.shields.io/badge/License-MIT-blue)](#license)

A fast, type-safe **CLI for optimizing web assets** — images, video, OG images,
SVG, favicons, and transparent-padding trim — built in TypeScript (strict, ESM).

One tool, one consistent flow: point it at a file or folder, get web-ready output
in a separate directory. Source files are never modified.

```bash
optikit img ./assets --out ./public/img      # → WebP (+ @1x/@2x), structure mirrored
optikit video compress hero.mp4 --max 3mb    # → web-sized mp4 under 3 MB
optikit favicon logo.svg                      # → full favicon set + <link> snippet
```

**Real numbers** (from the bundled `samples/`, default settings):

| Command | Input | Output |
| --- | --- | --- |
| `img` | 2.35 MB `@2x` PNG photo | **83 KB** WebP `@2x` — 96% smaller (full `@1x`/`@2x` pack in one pass) |
| `video compress` | 19 MB 4K clip | **0.96 MB** default · **2.9 MB** with `--max 3mb` |

## Requirements

- **Node.js ≥ 22**
- **ffmpeg** in your `PATH` — **only** for the `video` commands
  (`ffmpeg -version` to check; macOS: `brew install ffmpeg`).
  Image/SVG/favicon commands need nothing beyond the npm install.

## Install

```bash
npm install -g @gulyakevich/optikit
# or run once, without installing:
npx @gulyakevich/optikit --help
```

## Commands

All commands take an **input** (file, directory, or glob) and write to `--out`
(default `optimized/`), **mirroring the input's sub-folder structure**.

### `img` — raster images → WebP

```bash
optikit img ./assets --out ./public/img
optikit img hero@2x.png --avif        # also emit AVIF variants
optikit img photo.png --retina        # treat a plain image as @2x
```

- Default output: **WebP** (quality 85); `--avif` adds AVIF alongside.
- Retina rules (from the `@1x`/`@2x` filename convention):
  - `*@2x.{png,jpg}` → 4-variant pack: `@1x` + `@2x` in the original format **and** WebP.
  - `*@1x.*` without a `@2x` sibling, or a plain file → WebP only.
  - `--retina` treats a plain image as `@2x` (downscale only, never upscaled).
- Flags: `--out <dir>`, `--quality <1–100>`, `--avif`, `--retina`.

### `og` — Open Graph preview image

```bash
optikit og cover.png            # → cover-og.jpg (1200×630)
```

- Output: **1200×630 JPEG**, `cover` crop, suffix `-og`. Flags: `--out`, `--quality` (default 80).

### `video convert` — any video → web mp4

```bash
optikit video convert clip.mov                      # → clip.mp4 (H.264), resolution kept
optikit video convert clip.mov --preset desktop --mute
```

- Re-encodes any input (`.mov/.mkv/.webm/…`) to **web-friendly mp4 (H.264)**, keeping resolution.
- Flags: `--preset mobile|desktop`, `--crf <0–51>` (default 23), `--max-width <px>`, `--mute`, `--out`.

### `video compress` — shrink video for the web

```bash
optikit video compress hero.mp4                  # ≤1080p, web-tuned quality
optikit video compress hero.mp4 --preset mobile  # ≤720p
optikit video compress hero.mp4 --max 3mb        # hard size budget (2-pass)
```

- Default: caps to **≤1080p** at a web-leaning quality (CRF 28).
- `--max <size>` (e.g. `8mb`) targets a hard size budget via **2-pass** bitrate.
- Flags: `--preset`, `--crf`, `--max <size>`, `--max-width <px>`, `--mute`, `--out`.

> Real example: a 4K, 19 MB clip → **0.96 MB** (default) / **2.9 MB** (`--max 3mb`).

### `svg` — optimize SVG with svgo

```bash
optikit svg ./icons --out ./public/icons
optikit svg ./icons --keep-scripts          # keep interactive/animated SVGs intact
```

- Runs svgo's default preset (strips editor cruft, rounds coordinates). Typically **30–70% smaller**.
- **Executable content is removed by default** — `<script>`, `on*` handlers and
  `javascript:` links. svgo does not do this on its own, and an optimized SVG
  usually goes straight onto a page, where an inline `<script>` runs with the
  page's origin. Each affected file is named in the output, so nothing vanishes
  silently. Pass `--keep-scripts` if the SVG is meant to be interactive.
  This is a safe default, **not a sanitizer** — for SVG from an untrusted
  source, sanitize properly (e.g. DOMPurify) before putting it on a page.
- A file svgo cannot parse is reported by name and **skipped**; the rest of the
  batch still runs, and the command exits non-zero so CI notices.

### `favicon` — full favicon set from one image

```bash
optikit favicon logo.svg --out ./public
```

Generates from a single source (SVG or a large square PNG):

```text
favicon.ico (multi-res)   favicon-16x16.png   favicon-32x32.png   favicon-48x48.png
apple-touch-icon.png      android-chrome-192x192.png   android-chrome-512x512.png
site.webmanifest          favicon-snippet.html
```

- An **SVG source** also yields a scalable `favicon.svg`.
- Prints (and saves) a ready-to-paste `<head>` snippet.

### `trim` — crop transparent padding

```bash
optikit trim ./icons --out ./public/icons
optikit trim logo.png --threshold 50
```

- Trims transparent/empty padding from **PNG & WebP** (sharp `.trim()`) — handy for
  Figma exports with extra whitespace around an icon.
- Default threshold **120** (aggressive, clears alpha "ghosts"); tune with
  `--threshold <0–255>`. Flags: `--out`, `--threshold`.

## Presets (video resolution ceilings)

| Preset | Max width | Resolution |
| --- | --- | --- |
| `mobile` | 1280 px | 720p |
| `desktop` | 1920 px | 1080p |

Height is derived from the source aspect ratio; never upscaled.

## Output behaviour

- **Sources are never modified.** Output goes to `--out` (default `optimized/`),
  mirroring the input's structure — ready to drop into your project.
- **keep-smaller:** for same-format re-encodes (SVG, `@2x` originals), if the
  optimized file isn't smaller than the source, the original is kept — optimizing
  never makes a file worse.
- Re-runnable / idempotent: inputs are matched by source format, so generated
  outputs (WebP/AVIF/ICO) are never reprocessed.

## Under the hood

TypeScript (`strict` + `noUncheckedIndexedAccess`), ESM, Node 22. Four engines —
**sharp**, **ffmpeg** (`spawn`), **svgo**, **png-to-ico** — sit behind a single
`Tool<Job>` contract (Strategy), resolved by a small Factory and driven by a
uniform Command layer. Argv is validated at the boundary with **Zod**; pure logic
(naming, bitrate, presets) is covered by **Vitest**.

See [docs/architecture.md](docs/architecture.md) for the full design — layers,
type contracts, and data flow.

## Quality & Engineering

- **TypeScript strict** — `strict` + `noUncheckedIndexedAccess`, ESM, no `any` in the codebase.
- **Validated at the boundary** — every command's argv goes through a **Zod** schema before
  any work starts, so bad input fails fast with a readable message instead of deep inside sharp/ffmpeg.
- **Tested where it matters** — Vitest on the pure logic: output naming (`@1x`/`@2x` rules),
  2-pass bitrate math, human size parsing (`3mb`), preset resolution, and the argv schema.
  No tests on thin wrappers around sharp/ffmpeg — those libraries are already tested by their authors.
- **CI on every push and PR** — `lint → test → build` on Node 22 (GitHub Actions).
- **Publish gate** — `prepublishOnly` re-runs lint + tests + build, so a broken build
  can't reach npm.
- **Safe by design** — sources are never modified; **keep-smaller** means an "optimized"
  file is discarded if it isn't actually smaller than the original.

## Roadmap

Ideas for later (not yet implemented):

- `gif2video` — convert GIFs to mp4 (much smaller files)
- `blur` — generate LQIP base64 placeholders (for `next/image` / Astro)
- interactive mode — prompt for missing arguments (`@inquirer/prompts`)

## License

MIT

## Author

<a href="https://github.com/OlgaGulyakevich"><img src="https://wsrv.nl/?url=github.com/OlgaGulyakevich.png&w=96&h=96&mask=circle" width="48" height="48" alt="Olga Gulyakevich" align="left"></a>

**Olga Gulyakevich** — Frontend Developer

[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)](https://github.com/OlgaGulyakevich)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/olga-gulyakevich-ab166674/)

<br clear="left"/>
