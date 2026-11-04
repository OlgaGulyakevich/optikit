import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SharpTool, encodePlaceholder, renderRgba } from './sharp.tool.js';

const frame = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#c8ff00' } }).png().toBuffer();

/** Size of the image inside a data URL. */
const decodedSize = async (dataUrl: string) => {
  const { width, height } = await sharp(Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')).metadata();
  return { width, height };
};

const options = { maxWidth: 1920, quality: 40 };

describe('encodePlaceholder', () => {
  it('inlines a WebP an eighth of the poster wide', async () => {
    const { placeholder, aspectRatio } = await encodePlaceholder(await frame(1080, 1920), options);
    expect(placeholder.startsWith('data:image/webp;base64,')).toBe(true);
    expect(await decodedSize(placeholder)).toEqual({ width: 135, height: 240 });
    expect(aspectRatio).toBe(0.5625);
  });

  it('counts the eighth from the capped poster, not from a larger source', async () => {
    const { placeholder } = await encodePlaceholder(await frame(3840, 2160), options);
    expect((await decodedSize(placeholder)).width).toBe(240);
  });

  it('lets --placeholder-width choose a size', async () => {
    const { placeholder } = await encodePlaceholder(await frame(1080, 1920), { ...options, width: 32 });
    expect((await decodedSize(placeholder)).width).toBe(32);
  });

  it('never enlarges a frame smaller than the requested width', async () => {
    const { placeholder } = await encodePlaceholder(await frame(40, 40), { ...options, width: 64 });
    expect((await decodedSize(placeholder)).width).toBe(40);
  });
});

describe('SharpTool effort', () => {
  it('reaches the AVIF encoder: another effort gives other bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'optikit-sharp-'));
    try {
      // Noise, so the encoder has decisions to make. Small, and 0 against 5 rather
      // than 9: at the top effort this took 5 s and timed out on a busy machine.
      const noise = Buffer.from(Array.from({ length: 32 * 32 * 3 }, (_, i) => (i * 7919) % 251));
      const input = join(dir, 'noise.png');
      await sharp(noise, { raw: { width: 32, height: 32, channels: 3 } }).png().toFile(input);

      const encode = async (effort: number) => {
        const output = join(dir, `e${effort}.avif`);
        await new SharpTool().run({ input, output, format: 'avif', quality: 50, effort });
        return readFile(output);
      };

      expect((await encode(0)).equals(await encode(5))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('a phone photo tagged to be rotated', () => {
  let dir: string;
  let photo: string;

  // Stored 400×200 with the left half red, tagged "rotate 90° clockwise":
  // what a person sees is 200×400 with red on top.
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'optikit-exif-'));
    photo = join(dir, 'phone.jpg');
    const red = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#ff0000' } }).png().toBuffer();
    await sharp({ create: { width: 400, height: 200, channels: 3, background: '#0000ff' } })
      .composite([{ input: red, left: 0, top: 0 }])
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 95 })
      .toFile(photo);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** Size and whether the top of the image is red, read from a file with no tag left. */
  const look = async (input: string | Buffer) => {
    const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = Math.floor(info.width / 2) * info.channels + info.width * info.channels * 2;
    return { width: info.width, height: info.height, redOnTop: (data[i] ?? 0) > 150 && (data[i + 2] ?? 0) < 100 };
  };

  it.each(['webp', 'jpeg', 'avif', 'png'] as const)('comes out upright as %s', async (format) => {
    const output = join(dir, `upright.${format}`);
    await new SharpTool().run({ input: photo, output, format, quality: 85 });
    expect(await look(output)).toEqual({ width: 200, height: 400, redOnTop: true });
  });

  it('scales from the width a person sees, for @1x', async () => {
    const output = join(dir, 'half.webp');
    await new SharpTool().run({ input: photo, output, format: 'webp', quality: 85, scale: 0.5 });
    expect(await look(output)).toEqual({ width: 100, height: 200, redOnTop: true });
  });

  it('crops upright, for og and favicon sizes', async () => {
    const output = join(dir, 'crop.jpg');
    await new SharpTool().run({ input: photo, output, format: 'jpeg', quality: 85, resize: { width: 100, height: 100, fit: 'cover' } });
    const { width, height } = await look(output);
    expect({ width, height }).toEqual({ width: 100, height: 100 });
    const portrait = await sharp(output).extract({ left: 0, top: 0, width: 100, height: 2 }).removeAlpha().raw().toBuffer();
    expect((portrait[150] ?? 0) > 150).toBe(true);
  });

  it('renders upright for the plate check', async () => {
    const rgba = await renderRgba(photo, 100);
    expect(Array.from(rgba.subarray((2 * 100 + 50) * 4, (2 * 100 + 50) * 4 + 1))[0]).toBeGreaterThan(150);
  });

  it('gives a placeholder with the ratio and direction a person sees', async () => {
    const { placeholder, aspectRatio } = await encodePlaceholder(await readFile(photo), { maxWidth: 1920, quality: 40 });
    expect(aspectRatio).toBe(0.5);
    const image = Buffer.from(placeholder.split(',')[1] ?? '', 'base64');
    expect(await look(image)).toEqual({ width: 25, height: 50, redOnTop: true });
  });
});
