import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileExists } from '../../core/file.service.js';
import { placeholderCommand } from './placeholder.command.js';

let root: string;
let run = 0;

/** A fresh, empty pair of folders for one test. */
const folders = async () => {
  run += 1;
  const input = join(root, `in-${run}`);
  await mkdir(input);
  return { input, out: join(root, `out-${run}`) };
};

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#c8ff00' } });

const entries = async (out: string): Promise<Record<string, { placeholder: string; aspectRatio: number }>> =>
  JSON.parse(await readFile(join(out, 'placeholders.json'), 'utf8')) as Record<string, { placeholder: string; aspectRatio: number }>;

const widthOf = async (dataUrl: string) =>
  (await sharp(Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')).metadata()).width;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'optikit-placeholder-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('optikit placeholder', () => {
  // The reason this command exists: posters and photos that are already WebP or AVIF.
  it('takes every web raster format and leaves the rest alone', async () => {
    const { input, out } = await folders();
    await image(80, 80).webp().toFile(join(input, 'a.webp'));
    await image(80, 80).avif().toFile(join(input, 'b.avif'));
    await image(80, 80).jpeg().toFile(join(input, 'c.jpg'));
    await image(80, 80).png().toFile(join(input, 'd.png'));
    await writeFile(join(input, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await writeFile(join(input, 'notes.txt'), 'not an image');

    await placeholderCommand.run({ input, out });

    expect(Object.keys(await entries(out))).toEqual(['a.webp', 'b.avif', 'c.jpg', 'd.png']);
  });

  it('gives an inline image an eighth wide and the ratio that holds the space', async () => {
    const { input, out } = await folders();
    await image(1080, 1920).webp().toFile(join(input, 'poster.webp'));

    await placeholderCommand.run({ input, out });

    const { placeholder, aspectRatio } = (await entries(out))['poster.webp'] ?? { placeholder: '', aspectRatio: 0 };
    expect(placeholder.startsWith('data:image/webp;base64,')).toBe(true);
    expect(await widthOf(placeholder)).toBe(135);
    expect(aspectRatio).toBe(0.5625);
  });

  // An eighth of a 3840 px photo would be 480 px, far too heavy to inline in a page.
  it('counts the eighth from a 1920 px ceiling on a large photo', async () => {
    const { input, out } = await folders();
    await image(3840, 2160).webp().toFile(join(input, 'photo.webp'));

    await placeholderCommand.run({ input, out });

    expect(await widthOf((await entries(out))['photo.webp']?.placeholder ?? '')).toBe(240);
  });

  it('keeps sub-folders in the key, with forward slashes', async () => {
    const { input, out } = await folders();
    await mkdir(join(input, 'works (old)'));
    await image(80, 80).webp().toFile(join(input, 'top.webp'));
    await image(80, 80).webp().toFile(join(input, 'works (old)', 'clip.webp'));

    await placeholderCommand.run({ input, out });

    expect(Object.keys(await entries(out))).toEqual(['top.webp', 'works (old)/clip.webp']);
  });

  it('lets --width choose a size', async () => {
    const { input, out } = await folders();
    await image(1080, 1920).webp().toFile(join(input, 'poster.webp'));

    await placeholderCommand.run({ input, out, width: 32 });

    expect(await widthOf((await entries(out))['poster.webp']?.placeholder ?? '')).toBe(32);
  });

  it('keeps entries from earlier runs when one image is added', async () => {
    const { input, out } = await folders();
    await image(80, 80).webp().toFile(join(input, 'first.webp'));
    await placeholderCommand.run({ input: join(input, 'first.webp'), out });
    await image(80, 80).webp().toFile(join(input, 'second.webp'));

    await placeholderCommand.run({ input: join(input, 'second.webp'), out });

    expect(Object.keys(await entries(out))).toEqual(['first.webp', 'second.webp']);
  });

  it('does not read the output folder as input', async () => {
    const { input } = await folders();
    const out = join(input, 'optimized');
    await mkdir(out);
    await image(80, 80).webp().toFile(join(input, 'photo.webp'));
    await image(80, 80).webp().toFile(join(out, 'old.webp'));

    await placeholderCommand.run({ input, out });

    expect(Object.keys(await entries(out))).toEqual(['photo.webp']);
  });

  it('names a broken file, keeps the good ones and fails at the end', async () => {
    const { input, out } = await folders();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeFile(join(input, 'a-broken.webp'), 'not an image');
    await image(80, 80).webp().toFile(join(input, 'z-good.webp'));

    await expect(placeholderCommand.run({ input, out })).rejects.toThrow('1 of 2 file(s) failed');

    expect(Object.keys(await entries(out))).toEqual(['z-good.webp']);
    expect(error.mock.calls.flat().join('\n')).toContain('a-broken.webp');
  });

  it('leaves a placeholders.json it did not write alone, and stops', async () => {
    const { input, out } = await folders();
    await mkdir(out);
    const foreign = '{ "name": "my-app" }';
    await writeFile(join(out, 'placeholders.json'), foreign);
    await image(80, 80).webp().toFile(join(input, 'photo.webp'));

    await expect(placeholderCommand.run({ input, out })).rejects.toThrow('not a placeholder file');

    expect(await readFile(join(out, 'placeholders.json'), 'utf8')).toBe(foreign);
  });

  it('writes nothing when no image was found', async () => {
    const { input, out } = await folders();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await writeFile(join(input, 'notes.txt'), 'not an image');

    await placeholderCommand.run({ input, out });

    expect(await fileExists(join(out, 'placeholders.json'))).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('writes nothing when every image failed', async () => {
    const { input, out } = await folders();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeFile(join(input, 'broken.webp'), 'not an image');

    await expect(placeholderCommand.run({ input, out })).rejects.toThrow('1 of 1 file(s) failed');

    expect(await fileExists(join(out, 'placeholders.json'))).toBe(false);
  });
});
