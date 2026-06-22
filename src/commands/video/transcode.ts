import { basename, dirname, extname, join, relative } from 'node:path';
import type { FfmpegJob } from '../../tools/ffmpeg.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import type { ResolvedVideo } from './resolve-preset.js';

/** Accepted input video extensions (output is always mp4). */
const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

/** Glob `input` (file / dir / pattern) and keep only video files. */
export const collectVideos = async (input: string): Promise<string[]> =>
  (await collectInputs(input)).filter((file) => VIDEO.test(file));

/**
 * Transcode each file to web mp4 under `outDir`, mirroring the input structure.
 * Shared by `convert` and `compress`.
 */
export const transcodeVideos = async (
  files: readonly string[],
  resolved: ResolvedVideo,
  outDir: string,
): Promise<void> => {
  const base = commonBaseDir(files);
  const tool = createTool('ffmpeg');

  for (const input of files) {
    const output = join(
      outDir,
      relative(base, dirname(input)),
      `${basename(input, extname(input))}.mp4`,
    );
    const job: FfmpegJob = {
      input,
      output,
      crf: resolved.crf,
      mute: resolved.mute,
      ...(resolved.maxWidth === undefined ? {} : { maxWidth: resolved.maxWidth }),
    };

    await ensureDir(dirname(output));
    await tool.run(job);
    logger.success(output);
  }
};
