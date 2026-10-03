# optikit

[![npm](https://img.shields.io/npm/v/@gulyakevich/optikit?logo=npm&color=0A7EA4)](https://www.npmjs.com/package/@gulyakevich/optikit)
[![CI](https://github.com/OlgaGulyakevich/optikit/actions/workflows/ci.yml/badge.svg)](https://github.com/OlgaGulyakevich/optikit/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License MIT](https://img.shields.io/badge/License-MIT-blue)](#license)

A fast, type-safe **CLI for optimizing web assets** — images, video, OG images,
SVG, favicons, and transparent-padding trim — plus **optical centring for icons**.
Built in TypeScript (strict, ESM).

One tool, one consistent flow: point it at a file or folder, get web-ready output
in a separate directory. Source files are never modified.

```bash
optikit img ./assets --out ./public/img      # → WebP (+ @1x/@2x), structure mirrored
optikit video compress hero.mp4 --max 3mb    # → web-sized mp4 under 3 MB
optikit favicon logo.svg                      # → full favicon set + <link> snippet
optikit icon audit ./icons                    # → which icons look off-centre, and by how much
```

**Real numbers** (from the bundled `samples/`, default settings):

| Command | Input | Output |
| --- | --- | --- |
| `img` | 2.35 MB `@2x` PNG photo | **83 KB** WebP `@2x` — 96% smaller (full `@1x`/`@2x` pack in one pass) |
| `video compress` | 19 MB 4K clip | **0.96 MB** default · **2.9 MB** with `--max 3mb` |

## Requirements

- **Node.js ≥ 22**
- **ffmpeg** in your `PATH` — **only** for `video convert`, `compress`, `faststart` and `poster`
  (`ffmpeg -version` to check; macOS: `brew install ffmpeg`).
  Everything else — including `video check` — needs nothing beyond the npm install.

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
- Output is **faststart** (see below).
- Flags: `--preset mobile|desktop`, `--crf <0–51>` (default 23), `--max-width <px>`, `--mute`, `--out`.

### `video compress` — shrink video for the web

```bash
optikit video compress hero.mp4                  # ≤1080p, web-tuned quality
optikit video compress hero.mp4 --preset mobile  # ≤720p
optikit video compress hero.mp4 --max 3mb        # hard size budget (2-pass)
```

- Default: caps to **≤1080p** at a web-leaning quality (CRF 28).
- `--max <size>` (e.g. `8mb`) targets a hard size budget via **2-pass** bitrate.
- Output is **faststart** (see below).
- Flags: `--preset`, `--crf`, `--max <size>`, `--max-width <px>`, `--mute`, `--out`.

> Real example: a 4K, 19 MB clip → **0.96 MB** (default) / **2.9 MB** (`--max 3mb`).

### `video faststart` — make an mp4 play from the first bytes, without re-encoding

```bash
optikit video faststart ./clips --out ./public/video
```

An mp4 has an index (the `moov` atom) that the player needs before the first
frame. ffmpeg writes it **at the end** by default, so the browser has to fetch the
tail of the file with a second request before it can start — and every first play
shows a loading spinner. On a real 1.4 MB clip the index sat at 1404 KB of 1406.

- Moves the index to the front with a **stream copy** (`-c copy -movflags +faststart`):
  seconds, no quality loss, same codecs and container.
- For clips that are already compressed well. `convert` and `compress` do this on
  their own — every mp4 they write is faststart.
- Each output is re-read and verified before it is reported as done.

### `video check` — fail a build on a clip that isn't faststart

```bash
optikit video check ./public/video     # ✓ per file, exit 1 if any fails
```

- Reads only the atom headers (a few bytes per atom), so a large video costs
  nothing to check. Needs no ffmpeg.
- Exits **non-zero** when a file has its index after the media data — put it in CI
  or a pre-build step, and a clip that would spin on first play never ships.

### `video poster` — a still frame for `<video poster>`

```bash
optikit video poster ./clips                     # best frame per clip → clip-poster.webp
optikit video poster hero.mp4 --candidates 6     # 6 frames + a contact sheet to pick from
optikit video poster hero.mp4 --at 00:04.2       # exactly this moment
```

Without a poster the page shows an empty box until the first frame decodes; with
one of the same aspect ratio, the space is filled from the first paint.

- **Default — automatic.** The first frame is usually the worst (fade from black,
  motion blur, nobody in shot yet), so the whole clip (5–95%) is sampled in one
  decode pass. Dark and blown-out frames are dropped, and the sharpest one left wins
  (variance of the Laplacian — a standard blur metric). Good for pipelines.
- **`--candidates <n>`** (2–12) — the maths narrows it down, you choose. Writes `n`
  good frames from different parts of the clip (`clip-poster-1.webp` …) and a
  contact sheet with timecodes (`clip-posters.jpg`). Keep the one you like, or
  re-run with `--at`. A frame that is sharp is not always the one that sells: the
  open box beats the closed one, the smile beats mid-word.
- **`--at <time>`** — `4.2`, `00:04.2` or `00:00:04.2`.
- Output is WebP (quality 80), width capped at 1920 like `compress`, so poster and
  clip line up. Flags: `--at`, `--candidates`, `--max-width`, `--quality`, `--out`.

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

## Icon finishing

Not about file size — about geometry. These commands fix what the browser gets
right by the ruler and the eye still reads as wrong.

### `icon audit` — optical centring

```bash
optikit icon audit ./icons                       # report only
optikit icon audit ./icons --fix                 # write shifted copies to optimized/
optikit icon audit volume-off.svg --fix --same-as volume.svg
```

A browser centres an icon's **bounding box**; the eye centres its **ink**. A play
triangle centred by its box looks pushed left, because most of its mass sits near
the flat side. The audit renders each SVG, finds the centre of mass (pixel
positions averaged, weighted by opacity), and reports the gap from the canvas
centre — in viewBox units and in % of the canvas:

```text
✓ icons/ui/arrow-right.svg — centred (0.8%)
⚠ icons/marker/triangle.svg — ink off by x +0.00, y -1.00 (+0.00%, -3.57%) → shift translate(0 1)
⚠ icons/ui/volume.svg — ink off by x +1.13, y -0.00 (+4.05%, -0.00%); has strokes — check by eye
```

- **Report by default.** `--fix` writes corrected copies to `--out`; sources are
  never modified. The fix wraps the content in `translate()` and svgo bakes it into
  the path coordinates — no `transform` is left behind:
  `M3.5 7.5H24.5L14 24Z` → `M3.5 8.5h21L14 25Z`. Every fixed file is re-measured.
- `--amount full|half|<0–1>` — how much of the correction to apply (default `full`).
  The centre of mass is the upper bound; a static icon sometimes looks right at `0.75`.
- `--threshold <percent>` — offsets below this are left alone (default `1`).
  Even-stroke chevrons land around 0.8%.
- `--same-as <file>` — apply one icon's shift to every input. For state pairs
  (play/pause, sound on/off): fixed separately, the shared part would jump on toggle.
- Verdicts: `centred` · `shift` (filled shape — safe to fix) · `check by eye`
  (has strokes — decorative lines count as mass, so the number may be off).

**Before you `--fix`:**

- **Rotating icons** (accordion caret, expand arrow) — use the full amount. Rotation
  turns around the canvas centre; an off-centre mass swings in an arc.
- **Illustrations with decorative strokes** (rays, sparks) — report only.
- **Sets already aligned by their authors** (Lucide, Phosphor, SF Symbols) — don't
  fix; you would correct them twice.

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

### `--web-names` — safe file names, any language

Every command that writes files (except `favicon`, whose names are fixed) takes
`--web-names`:

```text
Отзыв кофе (2).MP4         → otzyv-kofe-2.mp4
Präsentation Zürich.mov    → praesentation-zuerich.mov
Case#2 FINAL.svg           → case-2-final.svg
Иконки UI/Лого Ёлка.svg    → ikonki-ui/logo-yolka.svg
hero@2x.png                → hero@2x.png   (already fine — unchanged)
```

A name that looks fine can still break on the web — and not only in Cyrillic:

- **one letter, two encodings** — `й`, `ä`, `é` can be stored as one character
  or as a letter plus a separate mark. They look identical and differ byte for
  byte, so a link that reads right returns 404;
- **case** — `Hero.MP4` and `hero.mp4` are one file on macOS/Windows, two on a
  Linux server;
- **`#`, `?`, `%`, `&`, spaces, brackets** — `case#2.mp4` is a link to `case`.

Any script → latin (Cyrillic, German `ä → ae` as in `stadt-zuerich.ch`, Czech,
Polish, Nordic…, via [`@sindresorhus/transliterate`](https://github.com/sindresorhus/transliterate)),
lowercase, everything but `a–z 0–9 . _ - @` → `-`. Folders are renamed too;
`@1x`/`@2x` survive. If two inputs would end up with the same name
(`Отзыв.mp4` and `otzyv.mp4`), the command stops **before** writing anything
and lists the pairs. Off by default, so existing output names never change.

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
  2-pass bitrate math, human size parsing (`3mb`), preset resolution, MP4 atom walking
  (incl. 64-bit sizes), centre-of-mass maths (a triangle balances at 1/3 of its height),
  poster frame scoring and timecodes, web names (incl. both encodings of one letter and
  name collisions), and the argv schemas.
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
