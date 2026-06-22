import { z } from 'zod';

/**
 * Validated config for the `img` command. argv is untrusted input, so it is
 * parsed here on the runtime boundary; everything downstream uses `ImgConfig`.
 */
export const imgSchema = z.object({
  /** Input file, directory, or glob to optimize. */
  input: z.string().min(1),
  /** Output directory; the input's sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** Encoding quality (1–100). CLI passes strings, so it is coerced. */
  quality: z.coerce.number().int().min(1).max(100).default(85),
  /** Also emit AVIF variants alongside WebP. */
  avif: z.boolean().default(false),
  /** Treat plain (suffix-less) inputs as @2x and emit @1x + @2x. */
  retina: z.boolean().default(false),
});

/** Type derived from the schema — single source of truth for the parsed config. */
export type ImgConfig = z.infer<typeof imgSchema>;
