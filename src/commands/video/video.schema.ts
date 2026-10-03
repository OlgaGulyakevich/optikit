import { z } from 'zod';
import { parseTimecode } from '../../utils/frame-score.js';

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
  /** Rename outputs to safe web names (any language → latin, lowercase, no spaces). */
  webNames: z.boolean().default(false),
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

/** `video faststart` — move the index to the front without re-encoding. */
export const faststartSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
  /** Output directory; input sub-structure is mirrored under it. */
  out: z.string().default('optimized'),
  /** Rename outputs to safe web names (any language → latin, lowercase, no spaces). */
  webNames: z.boolean().default(false),
});

export type FaststartConfig = z.infer<typeof faststartSchema>;

/** `video check` — report atom order; writes nothing. */
export const checkSchema = z.object({
  /** Input file, directory, or glob. */
  input: z.string().min(1),
});

export type CheckConfig = z.infer<typeof checkSchema>;

/** `video poster` — a still frame for `<video poster>`, chosen or picked by time. */
export const posterSchema = z
  .object({
    /** Input file, directory, or glob. */
    input: z.string().min(1),
    /** Output directory; input sub-structure is mirrored under it. */
    out: z.string().default('optimized'),
    /** Take the frame at this time instead of choosing one (`4.2`, `00:04.2`). */
    at: z
      .string()
      .transform((text, ctx) => {
        try {
          return parseTimecode(text);
        } catch (error) {
          ctx.issues.push({ code: 'custom', input: text, message: error instanceof Error ? error.message : String(error) });
          return z.NEVER;
        }
      })
      .optional(),
    /** Write this many good frames from across the clip + a contact sheet, to pick by eye. */
    candidates: z.coerce.number().int().min(2).max(12).optional(),
    /** Width cap; matches `compress`'s 1080p default so poster and clip line up. */
    maxWidth: z.coerce.number().int().positive().default(1920),
    /** WebP quality (1–100). */
    quality: z.coerce.number().int().min(1).max(100).default(80),
    /** Rename outputs to safe web names (any language → latin, lowercase, no spaces). */
    webNames: z.boolean().default(false),
  })
  .refine((config) => config.at === undefined || config.candidates === undefined, {
    message: 'use either --at or --candidates, not both',
    path: ['at'],
  });

export type PosterConfig = z.infer<typeof posterSchema>;
