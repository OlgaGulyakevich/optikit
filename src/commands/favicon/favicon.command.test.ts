import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { faviconCommand } from './favicon.command.js';

const ROUNDED_LIME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="128" fill="#c8ff00"/>
  <circle cx="256" cy="256" r="100" fill="#111111"/>
</svg>`;

const BARE_GLYPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="120" fill="#111111"/>
</svg>`;

/** The top-left pixel as [r, g, b, a]. */
const corner = async (path: string): Promise<number[]> => {
  const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return Array.from(data.subarray(0, 4));
};

let dir: string;
const run = async (svg: string, name: string, extra: Record<string, unknown> = {}) => {
  const input = join(dir, `${name}.svg`);
  const out = join(dir, name);
  await writeFile(input, svg);
  await faviconCommand.run({ input, out, ...extra });
  return out;
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'optikit-favicon-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('favicon apple-touch-icon', () => {
  it('fills the cut corners of a rounded icon with its own plate colour', async () => {
    const out = await run(ROUNDED_LIME, 'plate');
    expect(await corner(join(out, 'apple-touch-icon.png'))).toEqual([200, 255, 0, 255]);
  });

  it('keeps the other icons transparent: browsers and desktop PWAs draw them as they are', async () => {
    const out = await run(ROUNDED_LIME, 'others');
    expect((await corner(join(out, 'android-chrome-192x192.png')))[3]).toBe(0);
    expect((await corner(join(out, 'favicon-32x32.png')))[3]).toBe(0);
  });

  it('puts a bare glyph on white, the colour iOS would show anyway', async () => {
    const out = await run(BARE_GLYPH, 'glyph');
    expect(await corner(join(out, 'apple-touch-icon.png'))).toEqual([255, 255, 255, 255]);
  });

  it('lets --background override the plate colour', async () => {
    const out = await run(ROUNDED_LIME, 'chosen', { background: '#102030' });
    expect(await corner(join(out, 'apple-touch-icon.png'))).toEqual([16, 32, 48, 255]);
  });
});

describe('favicon --artwork', () => {
  const ARTWORK = 'media-artwork-512.png';

  it('is not written by default', async () => {
    const out = await run(ROUNDED_LIME, 'no-artwork');
    expect(await readdir(out)).not.toContain(ARTWORK);
  });

  it('writes a 512 px square with the plate colour in its corners', async () => {
    const out = await run(ROUNDED_LIME, 'artwork', { artwork: true });
    const { width, height } = await sharp(join(out, ARTWORK)).metadata();
    expect({ width, height }).toEqual({ width: 512, height: 512 });
    expect(await corner(join(out, ARTWORK))).toEqual([200, 255, 0, 255]);
  });

  it('follows --background, like apple-touch-icon', async () => {
    const out = await run(ROUNDED_LIME, 'artwork-chosen', { artwork: true, background: '#102030' });
    expect(await corner(join(out, ARTWORK))).toEqual([16, 32, 48, 255]);
  });

  it('puts a bare glyph on white rather than leaving it transparent', async () => {
    const out = await run(BARE_GLYPH, 'artwork-glyph', { artwork: true });
    expect(await corner(join(out, ARTWORK))).toEqual([255, 255, 255, 255]);
  });

  // The whole point of the separate name: iOS caches icons by address.
  it('is its own file, not a resized apple-touch-icon', async () => {
    const out = await run(ROUNDED_LIME, 'artwork-apple', { artwork: true });
    const [apple, artwork] = await Promise.all([
      sharp(join(out, 'apple-touch-icon.png')).metadata(),
      sharp(join(out, ARTWORK)).metadata(),
    ]);
    expect([apple.width, artwork.width]).toEqual([180, 512]);
  });
});
