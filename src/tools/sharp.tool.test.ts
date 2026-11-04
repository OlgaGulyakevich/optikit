import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { encodePlaceholder } from './sharp.tool.js';

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
