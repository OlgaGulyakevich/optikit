import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { registerConvert } from './convert.command.js';
import { registerCompress } from './compress.command.js';

/**
 * `video` — parent command grouping the video subcommands (`convert`, later
 * `compress`). It only wires subcommands; commander dispatches to their actions,
 * so `run` is unused here.
 */
export const videoCommand: CliCommand = {
  name: 'video',

  register(program: Program): void {
    const video = program.command('video').description('Optimize web video.');
    registerConvert(video);
    registerCompress(video);
  },

  run(): Promise<void> {
    return Promise.resolve();
  },
};
