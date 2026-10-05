import { basename, dirname, join, relative } from 'node:path';
import type { Command as Program } from 'commander';
import type { SvgoJob } from '../../tools/svgo.tool.js';
import { createTool } from '../../core/tool.factory.js';
import { logger } from '../../core/logger.js';
import { collectInputs, ensureDir } from '../../core/file.service.js';
import { commonBaseDir } from '../../utils/naming.js';
import {
  correctionFor,
  formatAmount,
  planFix,
  verdictFor,
  verifyFix,
  type FixPlan,
  type InkOffset,
  type Point,
} from '../../utils/optical-center.js';
import { WEB_NAMES_OPTION, assertNoWebNameCollisions, outputPath } from '../../utils/web-name.js';
import { auditSchema } from './icon.schema.js';
import { measureIcon } from './measure.js';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
const describeOffset = ({ units, percent }: InkOffset) =>
  `x ${signed(units.x)}, y ${signed(units.y)} (${signed(percent.x)}%, ${signed(percent.y)}%)`;
const worstPercent = ({ percent }: InkOffset) => Math.max(Math.abs(percent.x), Math.abs(percent.y));
const asTranslate = ({ x, y }: Point) => `translate(${x} ${y})`;

/** What `--fix` will do, in words — the same text with and without `--fix`. */
const describePlan = (plan: FixPlan): string => {
  if (plan.kind === 'translate') return `shift ${asTranslate(plan.shift)}`;
  const { minX, minY, width, height } = plan.viewBox;
  return (
    `shift ${asTranslate(plan.shift)} would cut the drawing off — grow the canvas to ` +
    `viewBox="${minX} ${minY} ${width} ${height}" instead ` +
    `(renders ~${Math.round(plan.shrink * 100)}% smaller in the same box)`
  );
};

/**
 * Rendering error allowed when comparing positions: 0.5% of the canvas side.
 * Far below what an eye sees at icon sizes, far above anti-aliasing noise.
 */
const toleranceFor = (box: { width: number; height: number }) => Math.max(box.width, box.height) * 0.005;

/**
 * Run `audit`: measure how far each icon's ink sits from its canvas centre and
 * say what to do. Measuring and correcting are one calculation, so `--fix`
 * reuses it to write corrected copies — and re-measures them on a padded
 * canvas, so a fix that cuts the drawing off or misses the target fails loudly.
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
  if (config.fix && config.webNames) assertNoWebNameCollisions(files, base);
  const svgo = createTool('svgo');
  const count = { ok: 0, marked: 0, shift: 0, check: 0, fixed: 0, failed: 0 };

  for (const file of files) {
    try {
      const before = await measureIcon(file);
      const { offset } = before;

      // Marked: centred on purpose at partial strength, or (none) deliberately
      // left as drawn — e.g. beside text. The residual is by design, and
      // re-fixing would apply a correction nobody asked for.
      if (before.mark !== undefined) {
        count.ok += 1;
        count.marked += 1;
        const how = before.mark === 0 ? 'left as drawn' : 'centred';
        logger.success(
          `${file} — ${how} on purpose (${formatAmount(before.mark)}), ${worstPercent(offset).toFixed(1)}% off centre by design`,
        );
        continue;
      }

      const verdict = verdictFor(offset, config.threshold, before.stroked);
      count[verdict] += 1;

      if (verdict === 'ok' && !shared) {
        logger.success(`${file} — centred (${worstPercent(offset).toFixed(1)}%)`);
        continue;
      }
      if (verdict === 'check' && !shared) {
        logger.warn(`${file} — ink off by ${describeOffset(offset)}; has strokes — check by eye`);
        continue;
      }

      const shift = shared ?? correctionFor(offset, config.amount);
      const tolerance = toleranceFor(before.viewBox);
      const plan = planFix(before.ink, before.viewBox, shift, tolerance);
      const source = shared ? ` (same as ${config.sameAs ?? ''})` : '';
      logger.warn(`${file} — ink off by ${describeOffset(offset)} → ${describePlan(plan)}${source}`);
      if (!config.fix) continue;

      const output = outputPath(
        config.out,
        join(config.out, relative(base, dirname(file)), basename(file)),
        config.webNames,
      );
      const job: SvgoJob = { input: file, output, opticalFix: { plan, amount: config.amount } };
      await ensureDir(dirname(output));
      const result = await svgo.run(job);
      result.notes?.forEach((note) => logger.warn(note));

      // Moving the drawing by `shift` and moving the canvas by −`shift` land the
      // ink in the same place relative to the new centre: offset + shift.
      const after = await measureIcon(output);
      const expected = { x: offset.units.x + shift.x, y: offset.units.y + shift.y };
      const failure = verifyFix(expected, after, tolerance);
      if (failure) throw new Error(`${output}: fix did not hold — ${failure}.`);

      count.fixed += 1;
      logger.success(
        `${output} — fixed (${formatAmount(config.amount)}): ${worstPercent(offset).toFixed(1)}% → ` +
          `${worstPercent(after.offset).toFixed(1)}% off centre, nothing cut off`,
      );
    } catch (error) {
      // A broken file must not end the audit of the rest.
      count.failed += 1;
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  const marked = count.marked > 0 ? ` (${count.marked} marked)` : '';
  logger.info(
    `Audited ${files.length} icon(s): ${count.ok} centred${marked}, ${count.shift} to shift, ${count.check} to check by eye.`,
  );
  if (config.fix) {
    logger.info(`Fixed ${count.fixed} icon(s) → "${config.out}". Sources untouched.`);
  } else if (count.shift > 0 || shared) {
    logger.info(`Run with --fix to write corrected copies to "${config.out}".`);
  }

  if (count.failed > 0) {
    throw new Error(`${count.failed} file(s) failed — listed above.`);
  }
};

/** Warnings that decide whether `--fix` is safe for a given icon set. */
const HELP_AFTER = `
How it works:
  The browser centres an icon's bounding box; the eye centres its ink. The audit
  renders each SVG, finds the centre of mass, and reports the gap in viewBox units
  and in % of the canvas. --fix moves the drawing (svgo bakes the translate into
  the paths) — or, when that would push it past the canvas edge, grows the viewBox
  instead and says how much smaller the icon renders. Every fixed file is
  re-measured; a fix that cuts ink off or misses its target fails.

Strength (--amount, default half):
  The centre of mass is the upper bound, not the target. A static icon in a small
  badge is also judged by the gaps to the badge edges — at full it can look
  over-shifted. Check the result by eye in the real badge.
  • Rotating icons (accordion caret, expand arrow): use --amount full — rotation
    turns around the canvas centre, so a partial fix still swings in an arc.

Before you --fix:
  • Illustrations with decorative strokes (rays, sparks): report only — the strokes
    count as mass and pull the result off.
  • Sets already aligned by their authors (Lucide, Phosphor, SF Symbols): don't fix —
    you would correct them twice.
  • State pairs (play/pause, sound on/off): fix both with --same-as <one of them>.

Marked icons:
  --fix writes data-optical="half" (or full, 0.75…) on the root <svg>. A marked
  icon is reported as centred on purpose and never fixed twice. Hand-tuned an
  icon yourself? Add the mark, and the audit will leave it alone.
  data-optical="none" (or "0") — left uncorrected on purpose: an icon beside
  text, where the eye measures the gap to the word, not the centre.

Examples:
  optikit icon audit ./icons                      # report only
  optikit icon audit ./icons --fix                # write half-corrected copies
  optikit icon audit caret.svg --fix --amount full
  optikit icon audit volume-off.svg --fix --same-as volume.svg
`;

/** Attach the `audit` subcommand to the `icon` parent command. */
export const registerAudit = (icon: Program): void => {
  icon
    .command('audit <input>')
    .description('Find icons that look off-centre (ink vs bounding box); --fix shifts them.')
    .option('--fix', 'write corrected copies (default: report only)')
    .option('--amount <value>', 'correction strength: full | half | 0–1, e.g. 0.75 (default: half)')
    .option('--threshold <percent>', 'ignore offsets below this % of the canvas (default: 1)')
    .option('--same-as <file>', "apply this icon's shift to every input (state pairs)")
    .option('-o, --out <dir>', 'output directory for fixed copies (default: optimized)')
    .option(...WEB_NAMES_OPTION)
    .addHelpText('after', HELP_AFTER)
    .action(async (input: string, options: Record<string, unknown>) => {
      await runAudit({ input, ...options });
    });
};
