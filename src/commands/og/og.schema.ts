import { z } from 'zod';

/**
 * Validated config for the `og` command. argv is untrusted input, so it is
 * parsed here on the runtime boundary; everything downstream uses `OgConfig`.
 */
export const ogSchema = z.object({
  /** Input file, directory, or glob to turn into og-images. */
  input: z.string().min(1),
  /** Output directory; the input's sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** JPEG quality (1–100). CLI passes strings, so it is coerced. */
  quality: z.coerce.number().int().min(1).max(100).default(80),
});

/** Type derived from the schema — single source of truth for the parsed config. */
export type OgConfig = z.infer<typeof ogSchema>;
