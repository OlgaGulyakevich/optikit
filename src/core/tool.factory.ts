import type { Engine, Tool } from './tool.js';

/** Lazily creates a concrete tool for one engine. */
type ToolFactory = () => Tool<unknown>;

/**
 * Engine → tool registry (Factory). Filled in as engines are implemented;
 * adding an engine means one new entry here — nothing else in core changes.
 *
 * `Partial` because not every engine is wired up yet.
 */
const registry: Partial<Record<Engine, ToolFactory>> = {
  // sharp:  () => new SharpTool(),   
  // ffmpeg: () => new FfmpegTool(),  
  // svgo:   () => new SvgoTool(),    
  // ico:    () => new IcoTool(),     
};

/**
 * Resolve the concrete tool registered for `engine`.
 *
 * @throws Error if no tool is registered for the engine yet.
 */
export const createTool = (engine: Engine): Tool<unknown> => {
  const make = registry[engine];
  if (!make) {
    throw new Error(`No tool registered for engine "${engine}"`);
  }
  return make();
};
