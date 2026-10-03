import { basename, dirname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import { correctionFor, verdictFor, type InkOffset, type Point } from '../../utils/optical-center.js';
import { auditSchema } from './icon.schema.js';
import { measureIcon } from './measure.js';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
const describeOffset = ({ units, percent }: InkOffset) =>
  `x ${signed(units.x)}, y ${signed(units.y)} (${signed(percent.x)}%, ${signed(percent.y)}%)`;
const worstPercent = ({ percent }: InkOffset) => Math.max(Math.abs(percent.x), Math.abs(percent.y));
const asTranslate = ({ x, y }: Point) => `translate(${x} ${y})`;

/**
 * Run `audit`: measure how far each icon's ink sits from its canvas centre and
 * say what to do. Measuring and correcting are one calculation, so `--fix`
 * reuses it to write shifted copies — and re-measures them to prove the result.
 */
export const runAudit = async (raw: unknown): Promise<void> => {
  const config = auditSchema.parse(raw); // runtime boundary: unknown → AuditConfig

  const files = (await collectInputs(config.input)).filter((file) =>
    file.toLowerCase().endsWith('.svg'),
  );
  if (files.length === 0) {
    logger.warn(`No SVG files found for "${config.input}".`);
    return;
  }

  // One shared shift for a state pair (play/pause, sound on/off): if each file
  // got its own, the shared part of the glyph would jump on toggle.
  const shared = config.sameAs
    ? correctionFor((await measureIcon(config.sameAs)).offset, config.amount)
    : undefined;

  const base = commonBaseDir(files);
  const svgo = createTool('svgo');
  const count = { ok: 0, shift: 0, check: 0, fixed: 0, failed: 0 };

  for (const file of files) {
    try {
      const { offset, stroked } = await measureIcon(file);
      const verdict = verdictFor(offset, config.threshold, stroked);
      const shift = shared ?? correctionFor(offset, config.amount);
      count[verdict] += 1;

      if (verdict === 'ok' && !shared) {
        logger.success(`${file} — centred (${worstPercent(offset).toFixed(1)}%)`);
        continue;
      }
      if (verdict === 'check' && !shared) {
        logger.warn(`${file} — ink off by ${describeOffset(offset)}; has strokes — check by eye`);
        continue;
      }

      const source = shared ? ` (same as ${config.sameAs ?? ''})` : '';
      logger.warn(`${file} — ink off by ${describeOffset(offset)} → shift ${asTranslate(shift)}${source}`);
      if (!config.fix) continue;

      const output = join(config.out, relative(base, dirname(file)), basename(file));
      const job: SvgoJob = { input: file, output, translate: shift };
      await ensureDir(dirname(output));
      const result = await svgo.run(job);
      result.notes?.forEach((note) => logger.warn(note));

      const after = await measureIcon(output);
      count.fixed += 1;
      logger.success(`${output} — fixed, now ${worstPercent(after.offset).toFixed(1)}% off centre`);
    } catch (error) {
      // A broken file must not end the audit of the rest.
      count.failed += 1;
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  logger.info(
    `Audited ${files.length} icon(s): ${count.ok} centred, ${count.shift} to shift, ${count.check} to check by eye.`,
  );
  if (config.fix) {
    logger.info(`Fixed ${count.fixed} icon(s) → "${config.out}". Sources untouched.`);
  } else if (count.shift > 0 || shared) {
    logger.info(`Run with --fix to write shifted copies to "${config.out}".`);
  }

  if (count.failed > 0) {
    throw new Error(`${count.failed} file(s) could not be measured — listed above.`);
  }
};

/** Warnings that decide whether `--fix` is safe for a given icon set. */
const HELP_AFTER = `
How it works:
  The browser centres an icon's bounding box; the eye centres its ink. The audit
  renders each SVG, finds the centre of mass, and reports the gap in viewBox units
  and in % of the canvas. --fix wraps the content in translate() and lets svgo bake
  the shift into the path coordinates.

Before you --fix:
  • Rotating icons (accordion caret, expand arrow): use the full amount — rotation
    turns around the canvas centre, so a partial fix still swings in an arc.
  • Illustrations with decorative strokes (rays, sparks): report only — the strokes
    count as mass and pull the result off.
  • Sets already aligned by their authors (Lucide, Phosphor, SF Symbols): don't fix —
    you would correct them twice.
  • State pairs (play/pause, sound on/off): fix both with --same-as <one of them>.

Examples:
  optikit icon audit ./icons                      # report only
  optikit icon audit ./icons --fix --amount 0.75  # write 75%-corrected copies
  optikit icon audit volume-off.svg --fix --same-as volume.svg
`;

/** Attach the `audit` subcommand to the `icon` parent command. */
export const registerAudit = (icon: Program): void => {
  icon
    .command('audit <input>')
    .description('Find icons that look off-centre (ink vs bounding box); --fix shifts them.')
    .option('--fix', 'write corrected copies (default: report only)')
    .option('--amount <value>', 'correction strength: full | half | 0–1, e.g. 0.75 (default: full)')
    .option('--threshold <percent>', 'ignore offsets below this % of the canvas (default: 1)')
    .option('--same-as <file>', "apply this icon's shift to every input (state pairs)")
    .option('-o, --out <dir>', 'output directory for fixed copies (default: optimized)')
    .addHelpText('after', HELP_AFTER)
    .action(async (input: string, options: Record<string, unknown>) => {
      await runAudit({ input, ...options });
    });
};
