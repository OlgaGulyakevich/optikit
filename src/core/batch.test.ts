import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertNoFailures, runBatch } from './batch.js';

const self = (name: string) => name;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runBatch', () => {
  it('reaches every item, even after one fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const done: string[] = [];

    const failed = await runBatch(['a', 'b', 'c'], self, async (name) => {
      if (name === 'a') throw new Error('broken');
      done.push(name);
      await Promise.resolve();
    });

    expect(done).toEqual(['b', 'c']);
    expect(failed).toBe(1);
  });

  it('names the item in the error: sharp does not', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await runBatch(['photo.png'], self, () => Promise.reject(new Error('unsupported image format')));

    expect(error).toHaveBeenCalledWith('✖ photo.png: unsupported image format');
  });

  it('does not name it twice when the message already does', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await runBatch(['a.mp4'], self, () => Promise.reject(new Error('a.mp4: no frame could be read.')));

    expect(error).toHaveBeenCalledWith('✖ a.mp4: no frame could be read.');
  });

  it('counts nothing when all succeed', async () => {
    expect(await runBatch(['a'], self, () => Promise.resolve())).toBe(0);
  });
});

describe('assertNoFailures', () => {
  it('stays quiet when nothing failed', () => {
    expect(() => assertNoFailures(0, 3)).not.toThrow();
  });

  it('throws, so a partial success still exits 1', () => {
    expect(() => assertNoFailures(1, 3)).toThrow('1 of 3 file(s) failed');
  });
});
