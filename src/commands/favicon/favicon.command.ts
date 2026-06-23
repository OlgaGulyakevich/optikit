import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import type { SharpJob } from '../../tools/sharp.tool.js';
import type { IcoJob } from '../../tools/ico.tool.js';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { ensureDir } from '../../core/file.service.js';
import { faviconSchema } from './favicon.schema.js';

/** PNG sizes to render from the source, with their output names. */
const PNG_ICONS = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
] as const;

/** PNG names packed into favicon.ico (multi-resolution). */
const ICO_INPUTS = ['favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png'];

const MANIFEST = {
  icons: [
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
};

/** Build the `<head>` markup; includes the SVG icon only when one was produced. */
const headSnippet = (hasSvg: boolean): string =>
  [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    ...(hasSvg ? ['<link rel="icon" href="/favicon.svg" type="image/svg+xml">'] : []),
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ].join('\n');

/** `favicon` — one source image → full favicon set + .ico + manifest + snippet. */
export const faviconCommand: CliCommand = {
  name: 'favicon',

  register(program: Program): void {
    program
      .command('favicon <input>')
      .description('Generate a full favicon set (+ .ico, manifest, <head> snippet) from one image.')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .action(async (input: string, options: Record<string, unknown>) => {
        await faviconCommand.run({ input, ...options });
      });
  },

  async run(raw: unknown): Promise<void> {
    const config = faviconSchema.parse(raw); // runtime boundary: unknown → FaviconConfig
    await ensureDir(config.out);

    const isSvgSource = config.input.toLowerCase().endsWith('.svg');
    const sharpTool = createTool('sharp');
    const icoTool = createTool('ico');

    // 1. Render the source into each PNG size (sharp).
    for (const { size, name } of PNG_ICONS) {
      const output = join(config.out, name);
      const job: SharpJob = {
        input: config.input,
        output,
        format: 'png',
        quality: 100,
        resize: { width: size, height: size, fit: 'cover' },
      };
      await sharpTool.run(job);
      logger.success(output);
    }

    // 2. Pack the small PNGs into favicon.ico (png-to-ico).
    const icoOutput = join(config.out, 'favicon.ico');
    const icoJob: IcoJob = { inputs: ICO_INPUTS.map((name) => join(config.out, name)), output: icoOutput };
    await icoTool.run(icoJob);
    logger.success(icoOutput);

    // 3. SVG source → bonus scalable favicon.svg (optimized via svgo).
    if (isSvgSource) {
      const svgOutput = join(config.out, 'favicon.svg');
      const svgJob: SvgoJob = { input: config.input, output: svgOutput };
      await createTool('svgo').run(svgJob);
      logger.success(svgOutput);
    }

    // 4. Web manifest.
    const manifestOutput = join(config.out, 'site.webmanifest');
    await writeFile(manifestOutput, JSON.stringify(MANIFEST, null, 2));
    logger.success(manifestOutput);

    // 5. <head> snippet — printed and saved to a file (so it isn't lost).
    const snippet = headSnippet(isSvgSource);
    const snippetOutput = join(config.out, 'favicon-snippet.html');
    await writeFile(snippetOutput, `<!-- optikit favicon — add to <head> -->\n${snippet}\n`);
    logger.success(snippetOutput);

    logger.info(`\nDone — favicon set written to "${config.out}".\n\nAdd to your <head>:\n\n${snippet}\n`);
    if (!isSvgSource) {
      logger.info('Tip: pass an SVG source to also get a scalable favicon.svg.\n');
    }
  },
};
