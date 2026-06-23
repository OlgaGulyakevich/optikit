import { z } from 'zod';

/** Validated config for the `favicon` command (argv boundary → FaviconConfig). */
export const faviconSchema = z.object({
  /** Source image (square-ish; svg or large png recommended). */
  input: z.string().min(1),
  /** Output directory for the favicon set. */
  out: z.string().default('optimized'),
});

export type FaviconConfig = z.infer<typeof faviconSchema>;
