import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { registerConvert } from './convert.command.js';
import { registerCompress } from './compress.command.js';
import { registerFaststart } from './faststart.command.js';
import { registerCheck } from './check.command.js';

/**
 * `video` — parent command grouping the video subcommands (`convert`,
 * `compress`, `faststart`, `check`). It only wires subcommands; commander dispatches to their actions,
 * so `run` is unused here.
 */
export const videoCommand: CliCommand = {
  name: 'video',

  register(program: Program): void {
    const video = program.command('video').description('Optimize web video.');
    registerConvert(video);
    registerCompress(video);
    registerFaststart(video);
    registerCheck(video);
  },

  run(): Promise<void> {
    return Promise.resolve();
  },
};
