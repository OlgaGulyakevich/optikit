import { z } from 'zod';

/** Validated config for the `svg` command (argv boundary → SvgConfig). */
export const svgSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Output directory; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /**
   * Keep `<script>`, `on*` handlers and `javascript:` links instead of stripping
   * them. Off by default: SVGs usually go straight onto a page, and an optimizer
   * that quietly passes executable content through is a bad default.
   */
  keepScripts: z.boolean().default(false),
});

export type SvgConfig = z.infer<typeof svgSchema>;
