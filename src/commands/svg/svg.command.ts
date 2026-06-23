import { basename, dirname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { svgSchema } from './svg.schema.js';

/** `svg` — optimize/minify SVG files with svgo (default preset). */
export const svgCommand: CliCommand = {
  name: 'svg',

  register(program: Program): void {
    program
      .command('svg <input>')
      .description('Optimize/minify SVG files with svgo (default preset).')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .action(async (input: string, options: Record<string, unknown>) => {
        await svgCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = svgSchema.parse(raw); // runtime boundary: unknown → SvgConfig

    const files = (await collectInputs(config.input)).filter((file) =>
      file.toLowerCase().endsWith('.svg'),
    );
    if (files.length === 0) {
      logger.warn(`No SVG files found for "${config.input}".`);
      return;
    }

    const base = commonBaseDir(files);
    const tool = createTool('svgo');

    for (const input of files) {
      const output = join(config.out, relative(base, dirname(input)), basename(input));
      const job: SvgoJob = { input, output };
      await ensureDir(dirname(output));
      await tool.run(job);
      logger.success(output);
    }

    logger.info(`Done — ${files.length} SVG(s) optimized to "${config.out}".`);
  },
};
