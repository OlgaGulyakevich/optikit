import { z } from 'zod';

/** Validated config for the `trim` command (argv boundary → TrimConfig). */
export const trimSchema = z.object({
  /** Input file, directory, or glob (PNG/WebP). */
  input: z.string().min(1),
  /** Output directory; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** Trim threshold — higher = more aggressive (kills Figma alpha "ghosts"). */
  threshold: z.coerce.number().min(0).default(120),
});

export type TrimConfig = z.infer<typeof trimSchema>;
