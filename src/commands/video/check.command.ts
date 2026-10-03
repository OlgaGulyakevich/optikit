import type { Command as Program } from 'commander';
import { logger } from '../../core/logger.js';
import { collectInputs } from '../../core/file.service.js';
import { checkSchema } from './video.schema.js';
import { MP4_FAMILY, checkFaststart, describeFailure } from './read-atoms.js';

/**
 * Run `check`: verify every video is faststart. Writes nothing. Exits non-zero
 * when a file fails, so a build or CI step can refuse a clip that would show
 * a loading spinner on first play.
 */
export const runCheck = async (raw: unknown): Promise<void> => {
  const config = checkSchema.parse(raw); // runtime boundary: unknown → CheckConfig

  const files = (await collectInputs(config.input)).filter((file) => MP4_FAMILY.test(file));
  if (files.length === 0) {
    logger.warn(`No mp4/m4v/mov files found for "${config.input}".`);
    return;
  }

  let failed = 0;
  for (const file of files) {
    const { status, fileSize } = await checkFaststart(file);
    if (status.ok) {
      logger.success(`${file} — faststart`);
      continue;
    }
    failed += 1;
    logger.error(`${file} — ${describeFailure(status, fileSize)}`);
  }

  if (failed === 0) {
    logger.info(`All ${files.length} video(s) are faststart.`);
    return;
  }
  // cli.ts turns this into `✖ …` plus exit code 1.
  throw new Error(`${failed} of ${files.length} video(s) are not faststart — fix: optikit video faststart <input>`);
};

/** Attach the `check` subcommand to the `video` parent command. */
export const registerCheck = (video: Program): void => {
  video
    .command('check <input>')
    .description('Check that videos are faststart (index before data); exits 1 if not.')
    .action(async (input: string) => {
      await runCheck({ input });
    });
};
