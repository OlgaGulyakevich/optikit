import { z } from 'zod';

/** Validated config for the `svg` command (argv boundary → SvgConfig). */
export const svgSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Output directory; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
});

export type SvgConfig = z.infer<typeof svgSchema>;
