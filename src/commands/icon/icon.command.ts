import type { Command as Program } from 'commander';
import type { CliCommand } from '../../core/command.js';
import { registerAudit } from './audit.command.js';

/**
 * `icon` — parent for icon finishing. Unlike the other commands this is about
 * geometry, not file size. It only wires subcommands, so `run` is unused.
 */
export const iconCommand: CliCommand = {
  name: 'icon',

  register(program: Program): void {
    const icon = program.command('icon').description('Finish icons: optical centring.');
    registerAudit(icon);
  },

  run(): Promise<void> {
    return Promise.resolve();
  },
};
