# samples/

Local sample assets for **manual** end-to-end testing of the CLI
(e.g. `optikit img ./samples/photo.png`).

The media files here are **git-ignored** on purpose — they are personal scratch
inputs and (especially video) would bloat the repository. Only this README is
tracked.

Drop a few representative files to cover edge cases:

- a small PNG and a JPG
- a PNG with transparency (alpha)
- a `@2x` retina image (e.g. `hero@2x.png`) to exercise `@1x`/`@2x` output
- a filename with spaces / non-ASCII characters
- one short, small video clip (for the `video` commands later)

Automated unit tests (Vitest) do **not** use these — they cover pure logic
(naming, bitrate, validation) and need no real media.
