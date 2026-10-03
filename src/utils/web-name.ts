import { join, relative, sep } from 'node:path';
import transliterate from '@sindresorhus/transliterate';

/**
 * Web-safe file names for any language — pure string/path logic, no IO.
 *
 * A name that looks fine can still break on the web: two encodings of one
 * letter (`й` as one code point or as `и` + breve) look identical and differ
 * byte for byte, `Hero.MP4` and `hero.mp4` are one file on macOS/Windows and
 * two on a Linux server, `#` cuts a URL short, and spaces need escaping
 * everywhere. A web name sidesteps all of it.
 */

/** The `--web-names` flag as commander takes it — one wording for every command. */
export const WEB_NAMES_OPTION = [
  '--web-names',
  'rename outputs to safe web names: any language → latin, lowercase, no spaces',
] as const;

/** Everything outside this set becomes a dash. `@` stays for `@1x`/`@2x`. */
const UNSAFE = /[^a-z0-9._@-]+/g;

/**
 * One path segment → lowercase latin slug. Transliterates any script the
 * library knows (Cyrillic, German `ä→ae`, Czech, Polish, Nordic…), then keeps
 * only URL-safe characters. Empty result (e.g. a name in a script with no
 * latin mapping) → `file`.
 */
export const slug = (text: string): string =>
  transliterate(text.normalize('NFC'))
    .toLowerCase()
    .replace(UNSAFE, '-')
    .replace(/-*([.@_])-*/g, '$1') // no dashes hugging `.`, `@`, `_`
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'file';

/** A file name → web name: slug for the stem, lowercase extension kept as-is. */
export const webName = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return slug(fileName);
  const ext = fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext ? `${slug(fileName.slice(0, dot))}.${ext}` : slug(fileName);
};

/** A relative path → every folder slugged, the last segment as a file name. */
export const webPath = (relativePath: string): string => {
  const parts = relativePath.split(sep);
  const file = parts.pop() ?? '';
  return join(...parts.map(slug), webName(file));
};

/** `output` under `outDir`, with everything below `outDir` renamed to web names. */
export const toWebOutput = (outDir: string, output: string): string =>
  join(outDir, webPath(relative(outDir, output)));

/** Output as-is, or its web-name form when `--web-names` is on. */
export const outputPath = (outDir: string, output: string, webNames: boolean): string =>
  webNames ? toWebOutput(outDir, output) : output;

/** `dir/name.ext` → `dir/name`; a leading-dot name (`.env`) has no extension. */
const withoutExtension = (path: string): string => {
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf(sep) + 1 ? path.slice(0, dot) : path;
};

/**
 * Pairs of inputs whose web names would land on the same file — e.g.
 * `Отзыв.mp4` and `otzyv.mp4`. Compared without the extension: commands
 * change it (`.png` → `.webp`), so `Фото.png` and `foto.jpg` collide too.
 * Same stem with a different extension is NOT reported: that clash exists
 * with or without web names and is not ours to judge.
 */
export const findWebNameCollisions = (relativePaths: readonly string[]): Array<[string, string]> => {
  const seen = new Map<string, string>();
  const collisions: Array<[string, string]> = [];

  for (const path of relativePaths) {
    const stem = withoutExtension(path);
    const key = stem.split(sep).map(slug).join('/');
    const first = seen.get(key);

    if (first === undefined) {
      seen.set(key, path);
    } else if (withoutExtension(first) !== stem) {
      collisions.push([first, path]);
    }
  }

  return collisions;
};

/**
 * Stop before any work if web names would overwrite one input's output with
 * another's — cheaper than discovering it after a ten-minute video encode.
 *
 * @throws Error listing every colliding pair.
 */
export const assertNoWebNameCollisions = (files: readonly string[], base: string): void => {
  const collisions = findWebNameCollisions(files.map((file) => relative(base, file)));
  if (collisions.length === 0) return;

  const pairs = collisions.map(([a, b]) => `  ${a}  ↔  ${b}`).join('\n');
  throw new Error(`--web-names would give these files the same name — rename one of each pair:\n${pairs}`);
};
