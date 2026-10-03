import { open } from 'node:fs/promises';
import { faststartStatus, listTopLevelAtoms, type FaststartStatus } from '../../utils/mp4-atoms.js';

/** Containers built on ISO BMFF — the ones that have a `moov` to check. */
export const MP4_FAMILY = /\.(mp4|m4v|mov)$/i;

/**
 * Read a file's top-level atoms from disk and judge their order. Only the atom
 * headers are read (a few bytes each), so a large video costs almost nothing.
 */
export const checkFaststart = async (
  path: string,
): Promise<{ status: FaststartStatus; fileSize: number }> => {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const read = async (offset: number, length: number): Promise<Uint8Array> => {
      const buffer = new Uint8Array(length);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    };
    return { status: faststartStatus(await listTopLevelAtoms(read, size)), fileSize: size };
  } finally {
    await file.close();
  }
};

/** Human verdict for a failed check, e.g. "moov at 1404 KB of 1406 KB". */
export const describeFailure = (status: Exclude<FaststartStatus, { ok: true }>, fileSize: number): string => {
  const kb = (bytes: number) => `${Math.round(bytes / 1000)} KB`;
  switch (status.reason) {
    case 'moov-after-mdat':
      return `index (moov) at ${kb(status.moovOffset)} of ${kb(fileSize)} — the first play waits for the end of the file`;
    case 'no-moov':
      return 'no index (moov) found — not a valid MP4, or truncated';
    case 'no-mdat':
      return 'no media data (mdat) found — not a valid MP4, or truncated';
  }
};
