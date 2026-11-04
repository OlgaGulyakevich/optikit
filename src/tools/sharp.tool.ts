import sharp from 'sharp';
import type { Tool, ToolResult } from '../core/tool.js';
import { aspectRatioOf, placeholderWidthFor, type Placeholder } from '../utils/placeholder.js';

/** Output formats the sharp engine can produce in optikit. */
export type SharpFormat = 'webp' | 'avif' | 'png' | 'jpeg';

/** How an absolute resize fits the target box (sharp `fit`). */
export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * One sharp operation: read `input`, optionally resize, encode to `format` at
 * `quality`, write to `output`. `scale` and `resize` are mutually exclusive.
 */
export interface SharpJob {
  input: string;
  output: string;
  format: SharpFormat;
  /** Encoding quality (1–100). Omit to keep the format with default (near-lossless) encoding. */
  quality?: number;
  /** CPU effort for the encoder (AVIF: 0–9). Omit for sharp's default. */
  effort?: number;
  /** Downscale factor, e.g. 0.5 for @2x → @1x. Omit (or 1) to keep original size. */
  scale?: number;
  /** Absolute target box, e.g. og 1200×630 with `fit: 'cover'`. */
  resize?: { width: number; height: number; fit?: ResizeFit };
  /** Trim transparent padding at this threshold (higher = more aggressive). */
  trim?: number;
  /** Fill all transparency with this colour; the output has no alpha left. */
  background?: string;
}

/**
 * Strategy implementation for raster images (sharp). In-process: each job is a
 * single `sharp(...).toFile(...)`. Absolute dimensions for a `scale` are read
 * from the source here (IO), so the naming layer can stay pure.
 */
export class SharpTool implements Tool<SharpJob> {
  async run(job: SharpJob): Promise<ToolResult> {
    const pipeline = sharp(job.input);

    if (job.trim !== undefined) {
      pipeline.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: job.trim });
    }

    if (job.resize) {
      pipeline.resize(job.resize.width, job.resize.height, { fit: job.resize.fit });
    } else if (job.scale && job.scale !== 1) {
      const { width } = await pipeline.metadata();
      if (width) {
        pipeline.resize(Math.round(width * job.scale));
      }
    }

    if (job.background !== undefined) {
      pipeline.flatten({ background: job.background });
    }

    await pipeline
      .toFormat(job.format, {
        ...(job.quality === undefined ? {} : { quality: job.quality }),
        ...(job.effort === undefined ? {} : { effort: job.effort }),
      })
      .toFile(job.output);

    return { outputs: [job.output] };
  }
}

/**
 * Rasterize SVG text and return only its alpha plane (one byte per pixel).
 * Feeds the optical-centre maths, which cares about where the ink is, not its
 * colour — librsvg draws `currentColor` as black, which is all we need.
 * The SVG must already carry the pixel `width`/`height` it should render at.
 */
export const renderAlpha = async (
  svg: string,
): Promise<{ alpha: Uint8Array; width: number; height: number }> => {
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { alpha: new Uint8Array(data), width: info.width, height: info.height };
};

/** Render an image to a `side`×`side` square of raw RGBA, cropped the way the favicon sizes are. */
export const renderRgba = async (input: string, side: number): Promise<Uint8Array> => {
  const data = await sharp(input).resize(side, side, { fit: 'cover' }).ensureAlpha().raw().toBuffer();
  return new Uint8Array(data);
};

/** Encode an in-memory image to WebP at `output`, capped at `maxWidth` (never upscaled). */
export const saveWebp = async (
  image: Buffer,
  output: string,
  { maxWidth, quality }: { maxWidth: number; quality: number },
): Promise<void> => {
  await sharp(image).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality }).toFile(output);
};

/**
 * Encode a frame as an inline WebP placeholder plus its aspect ratio. Without a chosen
 * `width` it is an eighth of the poster, counted after the same `maxWidth` cap.
 */
export const encodePlaceholder = async (
  image: Buffer,
  { maxWidth, quality, width }: { maxWidth: number; quality: number; width?: number },
): Promise<Placeholder> => {
  const { width: frameWidth, height: frameHeight } = await sharp(image).metadata();
  const small = await sharp(image)
    .resize({ width: width ?? placeholderWidthFor(Math.min(frameWidth, maxWidth)), withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toBuffer();
  return {
    placeholder: `data:image/webp;base64,${small.toString('base64')}`,
    aspectRatio: aspectRatioOf(frameWidth, frameHeight),
  };
};

/** Escape text for an SVG `<text>` node. */
const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Lay frames out in a grid, each with its label on a dark band — a contact
 * sheet to choose a poster from at a glance. Labels are drawn as SVG text,
 * which sharp (librsvg) renders with the system sans-serif font.
 */
export const saveContactSheet = async (
  tiles: readonly { image: Buffer; label: string }[],
  output: string,
  { columns, tileWidth }: { columns: number; tileWidth: number },
): Promise<void> => {
  const resized = await Promise.all(
    tiles.map(async ({ image, label }) => {
      const { data, info } = await sharp(image).resize({ width: tileWidth }).toBuffer({ resolveWithObject: true });
      return { data, height: info.height, label };
    }),
  );
  const tileHeight = Math.max(...resized.map((tile) => tile.height));
  const gap = 8;
  const rows = Math.ceil(resized.length / columns);
  const band = 36;

  const layers = resized.flatMap((tile, i) => {
    const left = gap + (i % columns) * (tileWidth + gap);
    const top = gap + Math.floor(i / columns) * (tileHeight + gap);
    const caption = Buffer.from(
      `<svg width="${tileWidth}" height="${band}"><rect width="100%" height="100%" fill="#000" fill-opacity="0.65"/>` +
        `<text x="12" y="25" font-family="sans-serif" font-size="18" fill="#fff">${escapeXml(tile.label)}</text></svg>`,
    );
    return [
      { input: tile.data, left, top },
      { input: caption, left, top: top + tile.height - band },
    ];
  });

  await sharp({
    create: {
      width: gap + columns * (tileWidth + gap),
      height: gap + rows * (tileHeight + gap),
      channels: 3,
      background: '#1a1a1a',
    },
  })
    .composite(layers)
    .jpeg({ quality: 85 })
    .toFile(output);
};
