import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import type { SharpJob } from '../../tools/sharp.tool.js';
import type { IcoJob } from '../../tools/ico.tool.js';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { renderRgba } from '../../tools/sharp.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { ensureDir } from '../../core/file.service.js';
import { chooseBackground } from '../../utils/icon-background.js';
import { faviconSchema } from './favicon.schema.js';

const APPLE_TOUCH = { size: 180, name: 'apple-touch-icon.png' } as const;
/** Same outcome as leaving the corners transparent, which iOS shows as white, but stated. */
const FALLBACK_BACKGROUND = '#ffffff';

/** PNG sizes to render from the source, with their output names. */
const PNG_ICONS = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  APPLE_TOUCH,
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

/**
 * The fill for apple-touch-icon.png. iOS masks the corners itself and shows any
 * transparency as white, so a rounded source gets white corners on the home screen.
 * This is the only icon filled: browsers and desktop PWAs draw the others as they
 * are, and their transparent corners look right there.
 */
const resolveAppleBackground = async (
  input: string,
  chosen: string | undefined,
): Promise<{ color?: string; note?: string; warning?: string }> => {
  if (chosen !== undefined) return { color: chosen, note: `on ${chosen}` };

  const background = chooseBackground(await renderRgba(input, APPLE_TOUCH.size), APPLE_TOUCH.size);
  switch (background.kind) {
    case 'opaque':
      return {};
    case 'plate':
      return { color: background.color, note: `corners filled with ${background.color}, the colour of its plate` };
    case 'no-plate':
      return {
        color: FALLBACK_BACKGROUND,
        warning: `${APPLE_TOUCH.name}: no solid plate to continue, so the transparency is on white. Choose a colour with --background <hex>.`,
      };
  }
};

/** `favicon` — one source image → full favicon set + .ico + manifest + snippet. */
export const faviconCommand: CliCommand = {
  name: 'favicon',

  register(program: Program): void {
    program
      .command('favicon <input>')
      .description('Generate a full favicon set (+ .ico, manifest, <head> snippet) from one image.')
      .option('-o, --out <dir>', 'output directory (default: optimized)')
      .option('--background <hex>', "fill behind apple-touch-icon.png (default: the source's plate colour, else white)")
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
    const apple = await resolveAppleBackground(config.input, config.background);

    // 1. Render the source into each PNG size (sharp).
    for (const { size, name } of PNG_ICONS) {
      const output = join(config.out, name);
      const isApple = name === APPLE_TOUCH.name;
      const job: SharpJob = {
        input: config.input,
        output,
        format: 'png',
        quality: 100,
        resize: { width: size, height: size, fit: 'cover' },
        ...(isApple && apple.color !== undefined ? { background: apple.color } : {}),
      };
      await sharpTool.run(job);
      logger.success(isApple && apple.note !== undefined ? `${output} (${apple.note})` : output);
      if (isApple && apple.warning !== undefined) logger.warn(apple.warning);
    }

    // 2. Pack the small PNGs into favicon.ico (png-to-ico).
    const icoOutput = join(config.out, 'favicon.ico');
    const icoJob: IcoJob = { inputs: ICO_INPUTS.map((name) => join(config.out, name)), output: icoOutput };
    await icoTool.run(icoJob);
    logger.success(icoOutput);

    // 3. SVG source → bonus scalable favicon.svg (optimized via svgo).
    if (isSvgSource) {
      const svgOutput = join(config.out, 'favicon.svg');
      // No opt-out here: a favicon with a script in it is never intentional.
      const svgJob: SvgoJob = { input: config.input, output: svgOutput };
      const { notes } = await createTool('svgo').run(svgJob);
      notes?.forEach((note) => logger.warn(note));
      logger.success(svgOutput);
    }

    // 4. Web manifest.
    const manifestOutput = join(config.out, 'site.webmanifest');
    await writeFile(manifestOutput, JSON.stringify(MANIFEST, null, 2));
    logger.success(manifestOutput);

    // 5. <head> snippet — printed and saved to a file (so it isn't lost).
    const snippet = headSnippet(isSvgSource);
    const snippetOutput = join(config.out, 'favicon-snippet.html');
    await writeFile(snippetOutput, `<!-- optikit favicon: add to <head> -->\n${snippet}\n`);
    logger.success(snippetOutput);

    logger.info(`\nDone: favicon set written to "${config.out}".\n\nAdd to your <head>:\n\n${snippet}\n`);
    if (!isSvgSource) {
      logger.info('Tip: pass an SVG source to also get a scalable favicon.svg.\n');
    }
  },
};
