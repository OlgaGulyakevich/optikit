import { readFile } from 'node:fs/promises';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { assertNoFailures, runBatch } from '../../core/batch.js';
import { collectInputs } from '../../core/file.service.js';
import { logger } from '../../core/logger.js';
import { encodePlaceholder } from '../../tools/sharp.tool.js';
import { commonBaseDir } from '../../utils/naming.js';
import { PLACEHOLDER_QUALITY, mergePlaceholders, placeholderKey } from '../../utils/placeholder.js';
import { PLACEHOLDER_FILE, placeholderPath, readPlaceholders, writePlaceholders } from './placeholder-file.js';
import { placeholderConfigSchema } from './placeholder.schema.js';

/** Includes WebP and AVIF: the images a page already serves are the ones that need this. */
const IMAGE = /\.(png|jpe?g|webp|avif)$/i;
/** Same ceiling as posters: an eighth of a 6K photo would be far too heavy to inline. */
const MAX_WIDTH = 1920;

/**
 * `placeholder` — images you already have → placeholders.json: a tiny inline image
 * to show until each one arrives, and the ratio that holds its space. The same file
 * and format as `video poster --placeholder`, for when there is no clip to take a
 * frame from.
 */
export const placeholderCommand: CliCommand = {
  name: 'placeholder',

  register(program: Program): void {
    program
      .command('placeholder <input>')
      .description(`Write ${PLACEHOLDER_FILE}: an inline image and aspect ratio for each image.`)
      .option('--width <px>', 'placeholder width 8–512 (default: an eighth of the image)')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .action(async (input: string, options: Record<string, unknown>) => {
        await placeholderCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = placeholderConfigSchema.parse(raw); // runtime boundary: unknown → PlaceholderConfig

    const files = (await collectInputs(config.input, config.out)).filter((file) => IMAGE.test(file));
    if (files.length === 0) {
      logger.warn(`No images found for "${config.input}".`);
      return;
    }

    // Read before any encoding: a file that is not ours should stop the run, not end it.
    let placeholders = await readPlaceholders(placeholderPath(config.out));
    const base = commonBaseDir(files);
    const { width } = config;

    const failed = await runBatch(files, (file) => file, async (file) => {
      const entry = await encodePlaceholder(await readFile(file), {
        maxWidth: MAX_WIDTH,
        quality: PLACEHOLDER_QUALITY,
        ...(width === undefined ? {} : { width }),
      });
      placeholders = mergePlaceholders(placeholders, { [placeholderKey(base, file)]: entry });
      logger.success(`${file} (${(entry.placeholder.length / 1000).toFixed(1)} kB)`);
    });

    if (failed < files.length) await writePlaceholders(config.out, placeholders);
    assertNoFailures(failed, files.length);
  },
};
