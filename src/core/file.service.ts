import { stat, unlink } from 'node:fs/promises';

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
