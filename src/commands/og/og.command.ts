import { dirname } from 'node:path';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { buildOgJobs, commonBaseDir } from '../../utils/naming.js';
import { ogSchema } from './og.schema.js';

/** `og` — generate 1200×630 cover JPEGs for Open Graph previews (*-og.jpg). */
export const ogCommand: CliCommand = {
  name: 'og',

  register(program: Program): void {
    program
      .command('og <input>')
      .description('Generate 1200×630 cover JPEGs for Open Graph (*-og.jpg).')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .option('-q, --quality <n>', 'JPEG quality 1–100 (default: 80)')
      .action(async (input: string, options: Record<string, unknown>) => {
        await ogCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = ogSchema.parse(raw); // runtime boundary: unknown → OgConfig

    const files = await collectInputs(config.input);
    const base = commonBaseDir(files);
    const jobs = buildOgJobs(files, {
      inputBase: base,
      outDir: config.out,
      quality: config.quality,
    });

    if (jobs.length === 0) {
      logger.warn(`No images found for "${config.input}".`);
      return;
    }

    const tool = createTool('sharp');
    for (const job of jobs) {
      await ensureDir(dirname(job.output));
      await tool.run(job);
      logger.success(job.output);
    }

    logger.info(`Done — ${jobs.length} og-image(s) written to "${config.out}".`);
  },
};
