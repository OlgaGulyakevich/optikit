import { basename, dirname, extname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { FfmpegJob } from '../../tools/ffmpeg.tool.js';
import { probeDuration } from '../../tools/ffmpeg.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { parseSize } from '../../utils/parse-size.js';
import { calcVideoBitrate } from '../../utils/calc-bitrate.js';
import { resolveVideoConfig } from './resolve-preset.js';
import { compressSchema } from './video.schema.js';
import { collectVideos, transcodeVideos } from './transcode.js';

/** Default web ceiling when neither a preset nor --max-width is given (1080p). */
const WEB_MAX_WIDTH = 1920;

/** Run `compress`: CRF by default, or 2-pass to a hard size budget with `--max`. */
export const runCompress = async (raw: unknown): Promise<void> => {
  const config = compressSchema.parse(raw); // runtime boundary: unknown → CompressConfig
  const resolved = resolveVideoConfig(config, { crf: 28, maxWidth: WEB_MAX_WIDTH });

  const files = await collectVideos(config.input);
  if (files.length === 0) {
    logger.warn(`No videos found for "${config.input}".`);
    return;
  }

  // Quality mode (default): single-pass CRF.
  if (config.max === undefined) {
    await transcodeVideos(files, resolved, config.out);
    logger.info(`Done — ${files.length} video(s) compressed to "${config.out}".`);
    return;
  }

  // Target-size mode: derive a bitrate per file (size ≈ bitrate × duration), 2-pass.
  const targetBytes = parseSize(config.max);
  const audioBitrate = resolved.mute ? 0 : 128_000;
  const base = commonBaseDir(files);
  const tool = createTool('ffmpeg');

  for (const input of files) {
    const durationSeconds = await probeDuration(input);
    const videoBitrate = calcVideoBitrate({ targetBytes, durationSeconds, audioBitrate });
    const output = join(
      config.out,
      relative(base, dirname(input)),
      `${basename(input, extname(input))}.mp4`,
    );
    const job: FfmpegJob = {
      input,
      output,
      videoBitrate,
      mute: resolved.mute,
      ...(resolved.maxWidth === undefined ? {} : { maxWidth: resolved.maxWidth }),
    };

    await ensureDir(dirname(output));
    await tool.run(job);
    logger.success(output);
  }

  logger.info(`Done — ${files.length} video(s) compressed to "${config.out}" (target ≤ ${config.max}).`);
};

/** Attach the `compress` subcommand to the `video` parent command. */
export const registerCompress = (video: Program): void => {
  video
    .command('compress <input>')
    .description('Compress video to web mp4 (≤1080p by default; --max for a size budget).')
    .option('--preset <name>', 'resolution ceiling: mobile (≤1280/720p) | desktop (≤1920/1080p)')
    .option('--crf <n>', 'quality 0–51, lower = better (default: 28; ignored with --max)')
    .option('--max <size>', 'hard size budget, e.g. 8mb (2-pass bitrate)')
    .option('--max-width <px>', 'cap output width (overrides preset/default)')
    .option('--mute', 'drop the audio track')
    .option('-o, --out <dir>', 'output directory (default: optimized)')
    .action(async (input: string, options: Record<string, unknown>) => {
      await runCompress({ input, ...options });
    });
};
