import { z } from 'zod';

/** Validated config for the `placeholder` command (argv boundary → PlaceholderConfig). */
export const placeholderConfigSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Where placeholders.json goes. */
  out: z.string().default('optimized'),
  /** Placeholder width in px. Omitted: an eighth of the image. */
  width: z.coerce.number().int().min(8).max(512).optional(),
});

export type PlaceholderConfig = z.infer<typeof placeholderConfigSchema>;
