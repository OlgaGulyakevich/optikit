import { basename, dirname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import type { ToolResult } from '../../core/tool.js';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir, keepSmaller } from '../../core/file.service.js';
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
      .option('--keep-scripts', 'keep <script>, on* handlers and javascript: links (stripped by default)')
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

    let failed = 0;

    for (const input of files) {
      const output = join(config.out, relative(base, dirname(input)), basename(input));
      const job: SvgoJob = { input, output, keepScripts: config.keepScripts };
      await ensureDir(dirname(output));

      let result: ToolResult;
      try {
        result = await tool.run(job);
      } catch (error) {
        // One malformed file must not take the rest of the batch with it.
        // Report which file, keep going, and account for it in the summary.
        failed += 1;
        logger.error(error instanceof Error ? error.message : String(error));
        continue;
      }

      result.notes?.forEach((note) => logger.warn(note));

      // svg → svg is a same-format re-encode, so keep-smaller normally applies —
      // unless the engine stripped something, in which case restoring the
      // original would bring it back.
      const keptOriginal = result.preserveOutput ? false : await keepSmaller(input, output);
      logger.success(keptOriginal ? `${output} (kept original — smaller)` : output);
    }

    if (failed === 0) {
      logger.info(`Done — ${files.length} SVG(s) optimized to "${config.out}".`);
      return;
    }

    logger.info(`Done — ${files.length - failed} of ${files.length} SVG(s) optimized to "${config.out}".`);
    // A batch that skipped files is not a success: cli.ts turns this into
    // `✖ …` plus a non-zero exit code, so CI and shell scripts can see it.
    throw new Error(`${failed} file(s) failed to parse — listed above.`);
  },
};
