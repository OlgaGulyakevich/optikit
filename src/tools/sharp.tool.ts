import sharp from 'sharp';
import type { Tool, ToolResult } from '../core/tool.js';

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
  quality: number;
  /** Downscale factor, e.g. 0.5 for @2x → @1x. Omit (or 1) to keep original size. */
  scale?: number;
  /** Absolute target box, e.g. og 1200×630 with `fit: 'cover'`. */
  resize?: { width: number; height: number; fit?: ResizeFit };
}

/**
 * Strategy implementation for raster images (sharp). In-process: each job is a
 * single `sharp(...).toFile(...)`. Absolute dimensions for a `scale` are read
 * from the source here (IO), so the naming layer can stay pure.
 */
export class SharpTool implements Tool<SharpJob> {
  async run(job: SharpJob): Promise<ToolResult> {
    const pipeline = sharp(job.input);

    if (job.resize) {
      pipeline.resize(job.resize.width, job.resize.height, { fit: job.resize.fit });
    } else if (job.scale && job.scale !== 1) {
      const { width } = await pipeline.metadata();
      if (width) {
        pipeline.resize(Math.round(width * job.scale));
      }
    }

    await pipeline.toFormat(job.format, { quality: job.quality }).toFile(job.output);

    return { outputs: [job.output] };
  }
}
