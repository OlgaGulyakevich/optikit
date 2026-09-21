import { readFile, writeFile } from 'node:fs/promises';
import { optimize } from 'svgo';
import type { Tool, ToolResult } from '../core/tool.js';

/** One svgo operation: read `input` SVG, optimize, write to `output`. */
export interface SvgoJob {
  input: string;
  output: string;
  /** Keep executable content instead of stripping it. Default: strip. */
  keepScripts?: boolean;
}

/**
 * A malformed SVG that svgo refused to parse, re-thrown with the file named.
 *
 * svgo reports positions against a literal `<input>` placeholder and never
 * mentions the source path, so in a batch of fifty icons its message leaves
 * nothing to search for. A raw `&` in `<title>Cats & Dogs</title>` is enough
 * to throw, and that is how design tools export.
 */
export class SvgParseError extends Error {
  constructor(
    readonly file: string,
    cause: unknown,
  ) {
    super(`${file}: ${detailOf(cause)}`, { cause });
    this.name = 'SvgParseError';
  }
}

/** svgo's own message with its uninformative `<input>:` prefix stripped. */
function detailOf(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.replace(/^<input>:/, '');
}

/** What svgo's `removeScripts` plugin strips: script elements, event handlers, `javascript:` URLs. */
const EXECUTABLE = /<script[\s>]|\son[a-z]+\s*=|javascript:/i;

/**
 * Whether an SVG carries anything executable.
 *
 * Used only to tell the user what was removed — the actual removal is svgo's
 * job. Deliberately a cheap text check: this is a heads-up, not a sanitizer.
 */
export function hasExecutableContent(svg: string): boolean {
  return EXECUTABLE.test(svg);
}

/**
 * Strategy implementation for SVG (svgo).
 *
 * In-process: read the SVG text, optimize, write the result. `removeScripts`
 * runs on top of the default preset unless the caller opts out — svgo does not
 * include it by default, and an optimized SVG usually goes straight onto a page.
 */
export class SvgoTool implements Tool<SvgoJob> {
  async run(job: SvgoJob): Promise<ToolResult> {
    const svg = await readFile(job.input, 'utf8');
    const strip = !job.keepScripts;

    let data: string;
    try {
      ({ data } = optimize(svg, {
        plugins: strip ? ['preset-default', 'removeScripts'] : ['preset-default'],
      }));
    } catch (cause) {
      throw new SvgParseError(job.input, cause);
    }

    await writeFile(job.output, data);

    const removed = strip && hasExecutableContent(svg);
    return {
      outputs: [job.output],
      notes: removed
        ? [`${job.input}: executable content removed — pass --keep-scripts to preserve it.`]
        : undefined,
      // Without this, a keep-smaller fallback could copy the original back and
      // quietly return the script we just removed.
      preserveOutput: removed,
    };
  }
}
