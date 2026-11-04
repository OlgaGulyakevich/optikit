import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from './check.command.js';

/** Build a top-level MP4 atom: a 4-byte big-endian size, the type, then padding. */
const atom = (type: string, bodySize = 8): Buffer => {
  const buffer = Buffer.alloc(8 + bodySize);
  buffer.writeUInt32BE(buffer.length, 0);
  buffer.write(type, 4, 'latin1');
  return buffer;
};

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'optikit-check-'));
  await writeFile(join(dir, 'ready.mp4'), Buffer.concat([atom('ftyp'), atom('moov'), atom('mdat')]));
  await writeFile(join(dir, 'late.mp4'), Buffer.concat([atom('ftyp'), atom('mdat'), atom('moov')]));
  await writeFile(join(dir, 'notes.txt'), 'not a video');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('video check', () => {
  it('passes a clip whose index comes first', async () => {
    await expect(runCheck({ input: join(dir, 'ready.mp4') })).resolves.toBeUndefined();
  });

  it('fails a clip whose index comes last', async () => {
    await expect(runCheck({ input: join(dir, 'late.mp4') })).rejects.toThrow('not faststart');
  });

  // A gate that lets nothing through its check must not report success: a typo
  // in the build script would otherwise switch the guard off for good.
  it('fails when the path does not exist', async () => {
    await expect(runCheck({ input: join(dir, 'missing.mp4') })).rejects.toThrow('nothing was checked');
  });

  it('fails when the path holds no videos', async () => {
    await expect(runCheck({ input: join(dir, 'notes.txt') })).rejects.toThrow('nothing was checked');
  });
});
