import { copyFile, mkdir, stat, unlink } from 'node:fs/promises';
import { glob } from 'tinyglobby';

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
 * Find files matching `input` — a directory (expanded recursively), a glob
 * pattern, or a single file. Sorted for deterministic, stable output.
 */
export const collectInputs = async (input: string): Promise<string[]> => {
  const files = await glob(input, { expandDirectories: true, absolute: false });
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
