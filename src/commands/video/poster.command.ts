import { basename, dirname, extname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import { extractFrame, probeDuration, sampleGrayFrames } from '../../tools/ffmpeg.tool.js';
import { saveContactSheet, saveWebp } from '../../tools/sharp.tool.js';
import { logger } from '../../core/logger.js';
import { ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { WEB_NAMES_OPTION, assertNoWebNameCollisions, outputPath } from '../../utils/web-name.js';
import {
  formatTimecode,
  frameStats,
  pickBest,
  pickSpread,
  sampleTimes,
  sampleWindow,
  type FrameStats,
} from '../../utils/frame-score.js';
import { posterSchema, type PosterConfig } from './video.schema.js';
import { collectVideos } from './transcode.js';

/** Frames sampled for automatic choice. */
const SAMPLES = 12;
/** Side frames are scored at — enough to tell blur from detail, cheap to scan. */
const SCORE_SIZE = 256;

/** Sample the clip in one decode pass and measure each frame. */
const scoreClip = async (input: string, duration: number, count: number): Promise<FrameStats[]> => {
  const times = sampleTimes(duration, count);
  const grays = await sampleGrayFrames(input, { ...sampleWindow(duration), count, size: SCORE_SIZE });
  return grays.flatMap((gray, i) => {
    const time = times[i];
    return time === undefined ? [] : [frameStats(gray, SCORE_SIZE, SCORE_SIZE, time)];
  });
};

/** One file: a poster at `--at`, the best frame, or N candidates + a contact sheet. */
const makePosters = async (input: string, base: string, config: PosterConfig): Promise<void> => {
  const stem = basename(input, extname(input));
  const dir = join(config.out, relative(base, dirname(input)));
  const target = (suffix: string) => outputPath(config.out, join(dir, `${stem}${suffix}`), config.webNames);
  const encode = { maxWidth: config.maxWidth, quality: config.quality };

  await ensureDir(dirname(target('-poster.webp')));
  const duration = await probeDuration(input);

  if (config.at !== undefined) {
    if (config.at >= duration) {
      throw new Error(`${input}: --at ${formatTimecode(config.at)} is past the end (${formatTimecode(duration)}).`);
    }
    const output = target('-poster.webp');
    await saveWebp(await extractFrame(input, config.at), output, encode);
    logger.success(`${output} (frame at ${formatTimecode(config.at)})`);
    return;
  }

  if (config.candidates === undefined) {
    const best = pickBest(await scoreClip(input, duration, SAMPLES));
    if (!best) throw new Error(`${input}: no frame could be read.`);
    const output = target('-poster.webp');
    await saveWebp(await extractFrame(input, best.time), output, encode);
    logger.success(`${output} (frame at ${formatTimecode(best.time)} — sharpest well-exposed one)`);
    return;
  }

  const frames = await scoreClip(input, duration, Math.max(SAMPLES, config.candidates * 3));
  const tiles: { image: Buffer; label: string }[] = [];

  for (const [i, frame] of pickSpread(frames, config.candidates).entries()) {
    const image = await extractFrame(input, frame.time);
    const output = target(`-poster-${i + 1}.webp`);
    await saveWebp(image, output, encode);
    tiles.push({ image, label: `${i + 1} · ${formatTimecode(frame.time)}` });
    logger.success(`${output} (${formatTimecode(frame.time)})`);
  }

  const sheet = target('-posters.jpg');
  await saveContactSheet(tiles, sheet, { columns: 3, tileWidth: 360 });
  logger.info(`Contact sheet: ${sheet} — keep the candidate you like, or re-run with --at <time>.`);
};

/**
 * Run `poster`: a still frame per video for `<video poster>`. Without it the
 * page shows an empty box until the first frame decodes; with a poster of the
 * same aspect ratio the space is filled — and held — from the first paint.
 */
export const runPoster = async (raw: unknown): Promise<void> => {
  const config = posterSchema.parse(raw); // runtime boundary: unknown → PosterConfig

  const files = await collectVideos(config.input);
  if (files.length === 0) {
    logger.warn(`No videos found for "${config.input}".`);
    return;
  }

  const base = commonBaseDir(files);
  if (config.webNames) assertNoWebNameCollisions(files, base);

  for (const input of files) {
    await makePosters(input, base, config);
  }

  logger.info(`Done — poster(s) for ${files.length} video(s) in "${config.out}".`);
};

/** Attach the `poster` subcommand to the `video` parent command. */
export const registerPoster = (video: Program): void => {
  video
    .command('poster <input>')
    .description('Pick a poster frame (sharp, well-exposed) and save it as WebP.')
    .option('--at <time>', 'use the frame at this time: 4.2 | 00:04.2 | 00:00:04.2')
    .option('--candidates <n>', 'save n good frames from across the clip + a contact sheet (2–12)')
    .option('--max-width <px>', 'cap poster width (default: 1920, matches compress)')
    .option('-q, --quality <n>', 'WebP quality 1–100 (default: 80)')
    .option('-o, --out <dir>', 'output directory (default: optimized)')
    .option(...WEB_NAMES_OPTION)
    .action(async (input: string, options: Record<string, unknown>) => {
      await runPoster({ input, ...options });
    });
};
