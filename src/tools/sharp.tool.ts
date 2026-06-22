import sharp from 'sharp';
import type { Tool, ToolResult } from '../core/tool.js';

/** Output formats the sharp engine can produce in optikit. */
export type SharpFormat = 'webp' | 'avif' | 'png' | 'jpeg';

/**
 * One sharp operation: read `input`, optionally downscale, encode to `format`
 * at `quality`, write to `output`.
 */
export interface SharpJob {
  input: string;
  output: string;
  format: SharpFormat;
  quality: number;
  /** Downscale factor, e.g. 0.5 for @2x → @1x. Omit (or 1) to keep original size. */
  scale?: number;
}

/**
 * Strategy implementation for raster images (sharp). In-process: each job is a
 * single `sharp(...).toFile(...)`. Absolute dimensions for a `scale` are read
 * from the source here (IO), so the naming layer can stay pure.
 */
export class SharpTool implements Tool<SharpJob> {
  async run(job: SharpJob): Promise<ToolResult> {
    const pipeline = sharp(job.input);

    if (job.scale && job.scale !== 1) {
      const { width } = await pipeline.metadata();
      if (width) {
        pipeline.resize(Math.round(width * job.scale));
      }
    }

    await pipeline.toFormat(job.format, { quality: job.quality }).toFile(job.output);

    return { outputs: [job.output] };
  }
}
