import { basename, dirname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { FfmpegJob } from '../../tools/ffmpeg.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { WEB_NAMES_OPTION, assertNoWebNameCollisions, outputPath } from '../../utils/web-name.js';
import { faststartSchema } from './video.schema.js';
import { MP4_FAMILY, checkFaststart, describeFailure } from './read-atoms.js';

/**
 * Run `faststart`: remux each file with the index moved to the front. Streams
 * are copied, not re-encoded — for clips that are already compressed well.
 * Each output is re-read and checked, so "done" means verified.
 */
export const runFaststart = async (raw: unknown): Promise<void> => {
  const config = faststartSchema.parse(raw); // runtime boundary: unknown → FaststartConfig

  const files = (await collectInputs(config.input)).filter((file) => MP4_FAMILY.test(file));
  if (files.length === 0) {
    logger.warn(`No mp4/m4v/mov files found for "${config.input}".`);
    return;
  }

  const base = commonBaseDir(files);
  if (config.webNames) assertNoWebNameCollisions(files, base);
  const tool = createTool('ffmpeg');

  for (const input of files) {
    // Same container in and out: a stream copy can't hit a codec the target rejects.
    const output = outputPath(
      config.out,
      join(config.out, relative(base, dirname(input)), basename(input)),
      config.webNames,
    );
    const job: FfmpegJob = { input, output, copy: true };

    await ensureDir(dirname(output));
    await tool.run(job);

    const { status, fileSize } = await checkFaststart(output);
    if (!status.ok) {
      throw new Error(`${output}: still not faststart — ${describeFailure(status, fileSize)}`);
    }
    logger.success(output);
  }

  logger.info(`Done — ${files.length} video(s) made faststart in "${config.out}" (no re-encode).`);
};

/** Attach the `faststart` subcommand to the `video` parent command. */
export const registerFaststart = (video: Program): void => {
  video
    .command('faststart <input>')
    .description('Move the mp4 index to the front without re-encoding (seconds, lossless).')
    .option('-o, --out <dir>', 'output directory (default: optimized)')
    .option(...WEB_NAMES_OPTION)
    .action(async (input: string, options: Record<string, unknown>) => {
      await runFaststart({ input, ...options });
    });
};
