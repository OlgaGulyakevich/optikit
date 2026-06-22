import { dirname } from 'node:path';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { buildImageJobs, commonBaseDir } from '../../utils/naming.js';
import { imgSchema } from './img.schema.js';

/** `img` — optimize raster images to WebP, applying the @1x/@2x retina rules. */
export const imgCommand: CliCommand = {
  name: 'img',

  register(program: Program): void {
    program
      .command('img <input>')
      .description('Optimize raster images to WebP, applying @1x/@2x retina rules.')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .option('-q, --quality <n>', 'encoding quality 1–100 (default: 85)')
      .option('--avif', 'also emit AVIF variants')
      .option('--retina', 'treat plain images as @2x (emit @1x + @2x)')
      .action(async (input: string, options: Record<string, unknown>) => {
        await imgCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = imgSchema.parse(raw); // runtime boundary: unknown → ImgConfig

    const files = await collectInputs(config.input);
    const base = commonBaseDir(files);
    const jobs = buildImageJobs(files, {
      inputBase: base,
      outDir: config.out,
      quality: config.quality,
      avif: config.avif,
      retina: config.retina,
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

    logger.info(`Done — ${jobs.length} file(s) written to "${config.out}".`);
  },
};
