import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SharpTool, encodePlaceholder } from './sharp.tool.js';

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
      // Noise, so the encoder has decisions to make.
      const noise = Buffer.from(Array.from({ length: 64 * 64 * 3 }, (_, i) => (i * 7919) % 251));
      const input = join(dir, 'noise.png');
      await sharp(noise, { raw: { width: 64, height: 64, channels: 3 } }).png().toFile(input);

      const encode = async (effort: number) => {
        const output = join(dir, `e${effort}.avif`);
        await new SharpTool().run({ input, output, format: 'avif', quality: 50, effort });
        return readFile(output);
      };

      expect((await encode(0)).equals(await encode(9))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
