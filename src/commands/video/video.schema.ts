import { z } from 'zod';

/** Fields shared by all `video` subcommands (validated on the argv boundary). */
const videoBaseSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Output directory; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** Resolution-ceiling preset. */
  preset: z.enum(['mobile', 'desktop']).optional(),
  /** Explicit width cap (overrides the preset). */
  maxWidth: z.coerce.number().int().positive().optional(),
  /** Drop the audio track. */
  mute: z.boolean().default(false),
});

/** `video convert` — re-encode any input to web mp4 at a quality (CRF). */
export const convertSchema = videoBaseSchema.extend({
  /** Quality knob (0–51; lower = better). Defaults when omitted. */
  crf: z.coerce.number().int().min(0).max(51).optional(),
});

export type ConvertConfig = z.infer<typeof convertSchema>;

/** `video compress` — shrink to web mp4 (CRF by default, or a `--max` budget). */
export const compressSchema = videoBaseSchema.extend({
  /** Quality knob (0–51; lower = better). Used when `--max` is absent. */
  crf: z.coerce.number().int().min(0).max(51).optional(),
  /** Hard size budget, e.g. "8mb" — triggers 2-pass bitrate mode. */
  max: z.string().optional(),
});

export type CompressConfig = z.infer<typeof compressSchema>;
