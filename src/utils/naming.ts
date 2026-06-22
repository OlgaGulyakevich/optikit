import { basename, dirname, extname, join, relative } from 'node:path';
import type { SharpFormat, SharpJob } from '../tools/sharp.tool.js';

/** Where and how image jobs are produced. */
export interface ImageNamingOptions {
  /** Base directory the inputs are relative to (used to mirror structure). */
  inputBase: string;
  /** Output directory root; the input's sub-structure is mirrored under it. */
  outDir: string;
  /** Encoding quality (1–100) for the generated variants. */
  quality: number;
  /** Also emit AVIF variants alongside WebP. */
  avif?: boolean;
  /** Treat plain (suffix-less) inputs as @2x and emit the full retina pack. */
  retina?: boolean;
}

const RASTER = /\.(png|jpe?g)$/i;

/** Sharp format that preserves the source raster format (png stays png, jpg → jpeg). */
const originalFormat = (ext: string): SharpFormat =>
  ext.toLowerCase() === '.png' ? 'png' : 'jpeg';

/** Output path mirroring the input's location relative to `inputBase` under `outDir`. */
const outPath = (input: string, fileName: string, opts: ImageNamingOptions): string =>
  join(opts.outDir, relative(opts.inputBase, dirname(input)), fileName);

/** Build one job; `scale` is omitted for full-size outputs. */
const makeJob = (
  input: string,
  fileName: string,
  format: SharpFormat,
  opts: ImageNamingOptions,
  scale?: number,
): SharpJob => {
  const base = { input, output: outPath(input, fileName, opts), format, quality: opts.quality };
  return scale === undefined ? base : { ...base, scale };
};

/**
 * Full retina pack for a `@2x` source with bare name `core`: the original format
 * at @1x (half) and @2x (full), WebP at both densities, and AVIF at both when
 * `opts.avif`. Only downscales — never upscales.
 */
const retinaPack = (
  input: string,
  core: string,
  ext: string,
  opts: ImageNamingOptions,
): SharpJob[] => {
  const orig = originalFormat(ext);
  const jobs: SharpJob[] = [
    makeJob(input, `${core}@1x${ext}`, orig, opts, 0.5),
    makeJob(input, `${core}@2x${ext}`, orig, opts),
    makeJob(input, `${core}@1x.webp`, 'webp', opts, 0.5),
    makeJob(input, `${core}@2x.webp`, 'webp', opts),
  ];
  if (opts.avif) {
    jobs.push(
      makeJob(input, `${core}@1x.avif`, 'avif', opts, 0.5),
      makeJob(input, `${core}@2x.avif`, 'avif', opts),
    );
  }
  return jobs;
};

/** Modern-format output for one image: WebP, plus AVIF when `opts.avif`. */
const webpPack = (input: string, name: string, opts: ImageNamingOptions): SharpJob[] => {
  const jobs = [makeJob(input, `${name}.webp`, 'webp', opts)];
  if (opts.avif) jobs.push(makeJob(input, `${name}.avif`, 'avif', opts));
  return jobs;
};

/**
 * Plan the sharp jobs for a batch of raster inputs, applying the `@1x`/`@2x`
 * retina rules. Pure: pairing is derived from `inputs` itself, no filesystem
 * access — the caller globs the files and passes the list.
 *
 * - `*@2x` → 4-variant pack (original @1x/@2x + WebP @1x/@2x); +AVIF with `avif`
 * - `*@1x` with a `@2x` sibling → skipped (the sibling already emits it)
 * - `*@1x` without a sibling → WebP (+AVIF) at its size
 * - plain file → WebP (+AVIF); with `retina`, treated as `@2x` (full pack)
 * - non-raster inputs are ignored
 */
export const buildImageJobs = (
  inputs: readonly string[],
  opts: ImageNamingOptions,
): SharpJob[] => {
  const present = new Set(inputs);
  const jobs: SharpJob[] = [];

  for (const input of inputs) {
    if (!RASTER.test(input)) continue;

    const ext = extname(input);
    const stem = basename(input, ext);

    if (stem.endsWith('@2x')) {
      jobs.push(...retinaPack(input, stem.slice(0, -'@2x'.length), ext, opts));
      continue;
    }

    if (stem.endsWith('@1x')) {
      const counterpart = join(dirname(input), `${stem.slice(0, -'@1x'.length)}@2x${ext}`);
      if (present.has(counterpart)) continue; // @2x sibling already covers this
      jobs.push(...webpPack(input, stem, opts));
      continue;
    }

    jobs.push(...(opts.retina ? retinaPack(input, stem, ext, opts) : webpPack(input, stem, opts)));
  }

  return jobs;
};

/** Options for og jobs — a subset of the image options (no retina/avif). */
export type OgNamingOptions = Pick<ImageNamingOptions, 'inputBase' | 'outDir' | 'quality'>;

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * Plan og-image jobs: each raster input → a 1200×630 `cover` JPEG named
 * `<name>-og.jpg`, mirroring the input structure under the out dir.
 */
export const buildOgJobs = (inputs: readonly string[], opts: OgNamingOptions): SharpJob[] => {
  const jobs: SharpJob[] = [];
  for (const input of inputs) {
    if (!RASTER.test(input)) continue;
    const stem = basename(input, extname(input));
    jobs.push({
      input,
      output: outPath(input, `${stem}-og.jpg`, opts),
      format: 'jpeg',
      quality: opts.quality,
      resize: { width: OG_WIDTH, height: OG_HEIGHT, fit: 'cover' },
    });
  }
  return jobs;
};

/**
 * Longest common parent directory of `files` — the base for mirroring the input
 * structure under the out dir. Returns '.' when the files share no parent.
 */
export const commonBaseDir = (files: readonly string[]): string => {
  const dirs = files.map((file) => dirname(file).split('/'));
  const [first, ...rest] = dirs;
  if (!first) return '.';

  let common = first;
  for (const segs of rest) {
    let i = 0;
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++;
    common = common.slice(0, i);
  }

  const base = common.join('/');
  return base === '' ? '.' : base;
};
