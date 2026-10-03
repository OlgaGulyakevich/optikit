/**
 * MP4 (ISO BMFF) top-level atom walking — enough to tell whether a file is
 * "faststart": its index (`moov`) sits before the media data (`mdat`).
 *
 * Without that, a browser has to fetch the end of the file before it can play
 * the first frame, and every first play shows a loading spinner.
 */

/** One top-level atom (a.k.a. box): its 4-char type, where it starts, how long it is. */
export interface Atom {
  readonly type: string;
  readonly offset: number;
  readonly size: number;
}

/** Reads `length` bytes at `offset`; may return fewer at the end of the file. */
export type ReadBytes = (offset: number, length: number) => Promise<Uint8Array>;

/** Largest header an atom can have: 4 size + 4 type + 8 extended size. */
const MAX_HEADER = 16;

/**
 * Parse one atom header from `bytes` (read at `offset`).
 *
 * Size field rules from the spec: `1` → the real size is the 64-bit field that
 * follows the type; `0` → the atom runs to the end of the file. Returns
 * `undefined` for a header that is truncated or claims an impossible size —
 * i.e. not an MP4 atom at all.
 */
export const parseAtomHeader = (
  bytes: Uint8Array,
  offset: number,
  fileSize: number,
): Atom | undefined => {
  if (bytes.length < 8) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = String.fromCharCode(...bytes.subarray(4, 8));
  let size = view.getUint32(0);
  let headerSize = 8;

  if (size === 1) {
    if (bytes.length < 16) return undefined;
    size = Number(view.getBigUint64(8));
    headerSize = 16;
  } else if (size === 0) {
    size = fileSize - offset;
  }

  if (size < headerSize || offset + size > fileSize) return undefined;
  return { type, offset, size };
};

/**
 * Walk the top-level atoms of a file without reading its body: only the
 * 8–16-byte header of each atom is read, then we jump over it. A 2 GB video
 * costs a handful of tiny reads.
 *
 * Stops at the first header that does not parse (a truncated or non-MP4 file).
 */
export const listTopLevelAtoms = async (read: ReadBytes, fileSize: number): Promise<Atom[]> => {
  const atoms: Atom[] = [];
  let offset = 0;

  while (offset < fileSize) {
    const atom = parseAtomHeader(await read(offset, MAX_HEADER), offset, fileSize);
    if (!atom) break;
    atoms.push(atom);
    offset += atom.size;
  }

  return atoms;
};

/** Verdict on atom order: playable from the first bytes, or not (and why). */
export type FaststartStatus =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'moov-after-mdat'; readonly moovOffset: number }
  | { readonly ok: false; readonly reason: 'no-moov' | 'no-mdat' };

/**
 * Is the file faststart? The index (`moov`) must come before the first media
 * data (`mdat`). Fragmented MP4 also passes: its `moov` leads, fragments follow.
 */
export const faststartStatus = (atoms: readonly Atom[]): FaststartStatus => {
  const moov = atoms.find((atom) => atom.type === 'moov');
  const mdat = atoms.find((atom) => atom.type === 'mdat');

  if (!moov) return { ok: false, reason: 'no-moov' };
  if (!mdat) return { ok: false, reason: 'no-mdat' };
  if (moov.offset > mdat.offset) {
    return { ok: false, reason: 'moov-after-mdat', moovOffset: moov.offset };
  }
  return { ok: true };
};
