import { basename, dirname, extname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import type { SharpFormat, SharpJob } from '../../tools/sharp.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { WEB_NAMES_OPTION, assertNoWebNameCollisions, outputPath } from '../../utils/web-name.js';
import { trimSchema } from './trim.schema.js';

/** Formats worth trimming (transparent padding lives in the alpha channel). */
const TRIMMABLE = /\.(png|webp)$/i;

const formatOf = (ext: string): SharpFormat => (ext.toLowerCase() === '.webp' ? 'webp' : 'png');

/** `trim` — crop transparent/empty padding from PNG & WebP images (sharp). */
export const trimCommand: CliCommand = {
  name: 'trim',

  register(program: Program): void {
    program
      .command('trim <input>')
      .description('Trim transparent/empty padding from PNG & WebP images (sharp).')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .option('-t, --threshold <n>', 'trim aggressiveness 0–255 (default: 120)')
      .option(...WEB_NAMES_OPTION)
      .action(async (input: string, options: Record<string, unknown>) => {
        await trimCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = trimSchema.parse(raw); // runtime boundary: unknown → TrimConfig

    const files = (await collectInputs(config.input)).filter((file) => TRIMMABLE.test(file));
    if (files.length === 0) {
      logger.warn(`No PNG/WebP files found for "${config.input}".`);
      return;
    }

    const base = commonBaseDir(files);
    if (config.webNames) assertNoWebNameCollisions(files, base);
    const tool = createTool('sharp');

    for (const input of files) {
      const ext = extname(input);
      const output = outputPath(
        config.out,
        join(config.out, relative(base, dirname(input)), basename(input)),
        config.webNames,
      );
      const job: SharpJob = {
        input,
        output,
        format: formatOf(ext),
        trim: config.threshold,
        // PNG stays lossless (no quality); WebP re-encodes at a safe high quality.
        ...(ext.toLowerCase() === '.webp' ? { quality: 90 } : {}),
      };

      await ensureDir(dirname(output));
      await tool.run(job);
      logger.success(output);
    }

    logger.info(`Done — ${files.length} image(s) trimmed to "${config.out}".`);
  },
};
