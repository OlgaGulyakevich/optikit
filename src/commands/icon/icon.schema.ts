import { z } from 'zod';

/** Named strengths for `--amount`; any number in (0, 1] works too. */
const AMOUNTS = { full: 1, half: 0.5 } as const;

/** Validated config for `icon audit` (argv boundary → AuditConfig). */
export const auditSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Output directory for fixed copies; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** Write corrected copies. Off by default: the audit only reports. */
  fix: z.boolean().default(false),
  /**
   * Share of the full correction to apply. The centre of mass is the upper
   * bound; a static icon sometimes looks right at 0.75. A rotating one needs `full`.
   */
  amount: z
    .union([
      z.enum(['full', 'half']).transform((name) => AMOUNTS[name]),
      z.coerce.number().gt(0).max(1),
    ])
    .default(1),
  /** Offsets below this % of the canvas are left alone (even-stroke chevrons land ~0.8%). */
  threshold: z.coerce.number().min(0).max(50).default(1),
  /** Apply this icon's correction instead of each file's own — keeps state pairs aligned. */
  sameAs: z.string().min(1).optional(),
});

export type AuditConfig = z.infer<typeof auditSchema>;
