import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, fileExists } from '../../core/file.service.js';
import { logger } from '../../core/logger.js';
import { parsePlaceholderFile, type PlaceholderFile } from '../../utils/placeholder.js';

/** The file both `placeholder` and `video poster --placeholder` keep their entries in. */
export const PLACEHOLDER_FILE = 'placeholders.json';

/** Where the placeholder file lives for an output folder. */
export const placeholderPath = (outDir: string): string => join(outDir, PLACEHOLDER_FILE);

/** What is already in the file, so a run for one new image keeps the rest. */
export const readPlaceholders = async (path: string): Promise<PlaceholderFile> =>
  (await fileExists(path)) ? parsePlaceholderFile(await readFile(path, 'utf8'), path) : {};

/** Write the file and report how much it adds to a page that inlines all of it. */
export const writePlaceholders = async (outDir: string, placeholders: PlaceholderFile): Promise<void> => {
  const path = placeholderPath(outDir);
  const json = `${JSON.stringify(placeholders, null, 2)}\n`;
  await ensureDir(outDir);
  await writeFile(path, json);
  const entries = Object.keys(placeholders).length;
  logger.success(`${path} (${entries} placeholder(s), ${(Buffer.byteLength(json) / 1000).toFixed(1)} kB in total)`);
};
