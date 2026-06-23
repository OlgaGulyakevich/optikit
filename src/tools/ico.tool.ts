import { writeFile } from 'node:fs/promises';
import pngToIco from 'png-to-ico';
import type { Tool, ToolResult } from '../core/tool.js';

/** One ico operation: pack PNG files into a multi-resolution `.ico`. */
export interface IcoJob {
  /** PNG source paths (e.g. 16/32/48 px). */
  inputs: string[];
  output: string;
}

/**
 * Strategy implementation for favicon `.ico` (png-to-ico). In-process: combine
 * several PNG sizes into one multi-resolution ICO buffer and write it out.
 */
export class IcoTool implements Tool<IcoJob> {
  async run(job: IcoJob): Promise<ToolResult> {
    const buffer = await pngToIco(job.inputs);
    await writeFile(job.output, buffer);
    return { outputs: [job.output] };
  }
}
