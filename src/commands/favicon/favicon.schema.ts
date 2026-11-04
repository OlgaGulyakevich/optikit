import { z } from 'zod';

/** `#c8ff00` or `c8ff00`, three or six digits: `#` starts a comment in bash, so it stays optional. */
const HEX_COLOUR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lowercase `#rrggbb`, whichever way the colour was typed. */
const toFullHex = (text: string): string => {
  const digits = text.replace('#', '').toLowerCase();
  return `#${digits.length === 3 ? digits.replace(/./g, '$&$&') : digits}`;
};

/** Validated config for the `favicon` command (argv boundary → FaviconConfig). */
export const faviconSchema = z.object({
  /** Source image (square-ish; svg or large png recommended). */
  input: z.string().min(1),
  /** Output directory for the favicon set. */
  out: z.string().default('optimized'),
  /** Also write media-artwork-512.png, an opaque square for Media Session. */
  artwork: z.boolean().default(false),
  /** Fill behind the opaque icons. Omitted: continue the source's plate, else white. */
  background: z.string().regex(HEX_COLOUR, 'use a hex colour, e.g. "#c8ff00"').transform(toFullHex).optional(),
});

export type FaviconConfig = z.infer<typeof faviconSchema>;
