import { readFile, writeFile } from 'node:fs/promises';
import { optimize } from 'svgo';
import type { Tool, ToolResult } from '../core/tool.js';

/** One svgo operation: read `input` SVG, optimize, write to `output`. */
export interface SvgoJob {
  input: string;
  output: string;
}

/**
 * Strategy implementation for SVG (svgo). In-process: read the SVG text,
 * optimize with svgo's default preset, write the result.
 */
export class SvgoTool implements Tool<SvgoJob> {
  async run(job: SvgoJob): Promise<ToolResult> {
    const svg = await readFile(job.input, 'utf8');
    const { data } = optimize(svg);
    await writeFile(job.output, data);
    return { outputs: [job.output] };
  }
}
