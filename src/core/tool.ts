/**
 * Core contracts for the engine layer (Strategy pattern).
 * Each engine (sharp / ffmpeg / svgo / ico) implements `Tool` for its own job type;
 * the factory maps an `Engine` value to the matching concrete tool.
 */

/** Supported optimization engines. Acts as the discriminator the factory routes on. */
export type Engine = 'sharp' | 'ffmpeg' | 'svgo' | 'ico';

/** Result of running one job: the paths of the files an engine produced. */
export interface ToolResult {
  readonly outputs: readonly string[];
}

/**
 * Strategy contract: an engine that runs a single job and reports its outputs.
 *
 * How a job runs — an external `spawn` (ffmpeg) or an in-process library call
 * (sharp / svgo / png-to-ico) — is private to each implementation. Callers depend
 * only on this interface, which is what makes the engines interchangeable.
 *
 * @typeParam Job - the engine-specific input describing one unit of work.
 */
export interface Tool<Job> {
  run(job: Job): Promise<ToolResult>;
}
