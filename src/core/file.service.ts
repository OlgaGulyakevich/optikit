import { copyFile, mkdir, stat, unlink } from 'node:fs/promises';
import { isAbsolute, normalize, posix } from 'node:path';
import { glob } from 'tinyglobby';
import { toPosixPath } from '../utils/naming.js';

/**
 * Filesystem helpers shared across tools. Path/name building lives in
 * `utils/naming.ts`; this module only touches the disk.
 */

/** Resolve to `true` if something exists at `path`, `false` otherwise. */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/** Delete the file at `path` if it exists; a no-op when it does not. */
export const deleteFileIfExists = async (path: string): Promise<void> => {
  if (await fileExists(path)) {
    await unlink(path);
  }
};

/** Create `dir` and any missing parents. Idempotent — a no-op when it exists. */
export const ensureDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });
};

/**
 * Find files for `input`: a file, a directory (expanded recursively), or a glob
 * pattern. Sorted for deterministic, stable output.
 *
 * The disk is asked first, because a real name can look like a pattern: `(1)` in
 * `a (1).mp4` is a glob group, so as a pattern it only matches `a 1.mp4`.
 *
 * Paths come back in the same form they went in: relative stays relative to
 * cwd, absolute stays absolute (instead of `../../../../private/tmp/…`). The
 * separator is always `/`, on Windows too, as the rest of the pipeline expects.
 */
export const collectInputs = async (input: string): Promise<string[]> => {
  const onDisk = await stat(input).catch(() => undefined);
  const path = toPosixPath(normalize(input));

  if (onDisk?.isFile()) return [path];
  if (onDisk?.isDirectory()) {
    const files = await glob('**/*', { cwd: input });
    return files.map((file) => posix.join(path, file)).sort();
  }

  const files = await glob(toPosixPath(input), { expandDirectories: true, absolute: isAbsolute(input) });
  return files.sort();
};

/**
 * "Never make it worse": if `output` is not smaller than `input`, overwrite it
 * with a copy of `input`. Only valid when output is a same-format, same-size
 * re-encode of the source. Returns true if the original was kept.
 */
export const keepSmaller = async (input: string, output: string): Promise<boolean> => {
  const [src, out] = await Promise.all([stat(input), stat(output)]);
  if (out.size >= src.size) {
    await copyFile(input, output);
    return true;
  }
  return false;
};
