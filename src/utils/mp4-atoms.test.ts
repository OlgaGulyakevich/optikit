import { describe, it, expect } from 'vitest';
import { faststartStatus, listTopLevelAtoms, parseAtomHeader, type Atom } from './mp4-atoms.js';

/** A fake atom: 32-bit size + 4-char type + `body` zero bytes. */
const atom = (type: string, body = 0): Uint8Array => {
  const bytes = new Uint8Array(8 + body);
  new DataView(bytes.buffer).setUint32(0, 8 + body);
  bytes.set([...type].map((char) => char.charCodeAt(0)), 4);
  return bytes;
};

/** Glue atoms into one "file" and expose it through the same reader the CLI uses. */
const fakeFile = (...parts: Uint8Array[]) => {
  const file = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    file.set(part, offset);
    offset += part.length;
  }
  const read = (at: number, length: number) => Promise.resolve(file.subarray(at, at + length));
  return { read, size: file.length };
};

const types = (atoms: Atom[]) => atoms.map((a) => a.type);

describe('listTopLevelAtoms', () => {
  it('lists atoms in file order with offsets', async () => {
    const { read, size } = fakeFile(atom('ftyp', 16), atom('moov', 100), atom('mdat', 1000));
    const atoms = await listTopLevelAtoms(read, size);

    expect(types(atoms)).toEqual(['ftyp', 'moov', 'mdat']);
    expect(atoms[1]).toEqual({ type: 'moov', offset: 24, size: 108 });
  });

  it('stops at a header that does not parse (truncated file)', async () => {
    const broken = atom('mdat', 1000).subarray(0, 50); // claims 1008 bytes, has 50
    const { read, size } = fakeFile(atom('ftyp', 16), broken);

    expect(types(await listTopLevelAtoms(read, size))).toEqual(['ftyp']);
  });

  it('returns nothing for a file that is not an MP4', async () => {
    const text = new TextEncoder().encode('hello, this is not a video');
    const read = (at: number, length: number) => Promise.resolve(text.subarray(at, at + length));

    expect(await listTopLevelAtoms(read, text.length)).toEqual([]);
  });
});

describe('parseAtomHeader', () => {
  it('reads the 64-bit size when the 32-bit field is 1', () => {
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    view.setUint32(0, 1);
    header.set([0x6d, 0x64, 0x61, 0x74], 4); // "mdat"
    view.setBigUint64(8, 5_000_000_000n); // > 4 GB, needs 64 bits

    expect(parseAtomHeader(header, 0, 6_000_000_000)).toEqual({
      type: 'mdat',
      offset: 0,
      size: 5_000_000_000,
    });
  });

  it('treats size 0 as "runs to the end of the file"', () => {
    const header = atom('mdat');
    new DataView(header.buffer).setUint32(0, 0);

    expect(parseAtomHeader(header, 40, 1040)).toEqual({ type: 'mdat', offset: 40, size: 1000 });
  });
});

describe('faststartStatus', () => {
  const at = (type: string, offset: number): Atom => ({ type, offset, size: 8 });

  it('passes when moov comes before mdat', () => {
    expect(faststartStatus([at('ftyp', 0), at('moov', 32), at('mdat', 900)])).toEqual({ ok: true });
  });

  it('fails when moov sits after mdat — the spinner case', () => {
    expect(faststartStatus([at('ftyp', 0), at('mdat', 32), at('moov', 1_437_000)])).toEqual({
      ok: false,
      reason: 'moov-after-mdat',
      moovOffset: 1_437_000,
    });
  });

  it('names a missing atom instead of guessing', () => {
    expect(faststartStatus([at('ftyp', 0), at('mdat', 32)])).toEqual({ ok: false, reason: 'no-moov' });
    expect(faststartStatus([at('ftyp', 0), at('moov', 32)])).toEqual({ ok: false, reason: 'no-mdat' });
  });
});
