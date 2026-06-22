import type { Command as Program } from 'commander';
import { logger } from '../../core/logger.js';
import { resolveVideoConfig } from './resolve-preset.js';
import { convertSchema } from './video.schema.js';
import { collectVideos, transcodeVideos } from './transcode.js';

/** Run `convert`: re-encode matched videos to web mp4, keeping resolution. */
export const runConvert = async (raw: unknown): Promise<void> => {
  const config = convertSchema.parse(raw); // runtime boundary: unknown → ConvertConfig
  // convert = faithful transcode: keep resolution by default, high quality.
  const resolved = resolveVideoConfig(config, { crf: 23 });

  const files = await collectVideos(config.input);
  if (files.length === 0) {
    logger.warn(`No videos found for "${config.input}".`);
    return;
  }

  await transcodeVideos(files, resolved, config.out);
  logger.info(`Done — ${files.length} video(s) written to "${config.out}".`);
};

/** Attach the `convert` subcommand to the `video` parent command. */
export const registerConvert = (video: Program): void => {
  video
    .command('convert <input>')
    .description('Re-encode any video to web-friendly mp4 (H.264), keeping resolution.')
    .option('--preset <name>', 'resolution ceiling: mobile (≤1280/720p) | desktop (≤1920/1080p)')
    .option('--crf <n>', 'quality 0–51, lower = better (default: 23)')
    .option('--max-width <px>', 'cap output width (overrides preset)')
    .option('--mute', 'drop the audio track')
    .option('-o, --out <dir>', 'output directory (default: optimized)')
    .action(async (input: string, options: Record<string, unknown>) => {
      await runConvert({ input, ...options });
    });
};
