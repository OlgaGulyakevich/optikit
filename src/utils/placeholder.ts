import { relative } from 'node:path';
import { z } from 'zod';
import { toPosixPath } from './naming.js';

/** One poster's entry in placeholders.json. */
const placeholderSchema = z.object({
  /** Tiny inline WebP to show until the poster arrives. */
  placeholder: z.string(),
  /** Width ÷ height, ready for CSS `aspect-ratio`, so the box holds its space. */
  aspectRatio: z.number(),
});

export type Placeholder = z.infer<typeof placeholderSchema>;

/** placeholders.json: poster path, relative to the output folder → its entry. */
const placeholderFileSchema = z.record(z.string(), placeholderSchema);

export type PlaceholderFile = z.infer<typeof placeholderFileSchema>;

/** Narrowest placeholder worth encoding. */
const MIN_WIDTH = 16;

/**
 * Default placeholder width: an eighth of the poster. At that size a person, a gesture
 * and a product are still recognisable, and it costs 1–3 kB. A 16 px image under a
 * heavy blur only says "something brownish is loading".
 */
export const placeholderWidthFor = (posterWidth: number): number =>
  Math.max(MIN_WIDTH, Math.round(posterWidth / 8));

/** Width ÷ height, rounded to what CSS needs. */
export const aspectRatioOf = (width: number, height: number): number =>
  Math.round((width / height) * 10_000) / 10_000;

/** The key a page looks a poster up by: relative to the output folder, forward slashes. */
export const placeholderKey = (outDir: string, posterPath: string): string =>
  toPosixPath(relative(outDir, posterPath));

/** Entries from earlier runs plus this run's, sorted so a re-run gives a clean diff. */
export const mergePlaceholders = (existing: PlaceholderFile, added: PlaceholderFile): PlaceholderFile =>
  Object.fromEntries(
    Object.entries({ ...existing, ...added }).sort(([a], [b]) => (a < b ? -1 : 1)),
  );

/**
 * Read a placeholders.json that is about to be overwritten. Anything that is not
 * provably ours stops the command, so a file someone else keeps under this name survives.
 */
export const parsePlaceholderFile = (text: string, path: string): PlaceholderFile => {
  try {
    return placeholderFileSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(`${path} is not a placeholder file, so it was left alone. Move it, or pick another --out.`);
  }
};
