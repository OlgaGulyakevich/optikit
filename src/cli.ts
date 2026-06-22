#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import type { CliCommand } from './core/command.js';
import { logger } from './core/logger.js';
import { imgCommand } from './commands/img/img.command.js';

// Read our own version at runtime (single source of truth = package.json).
// `import.meta.url` is the ESM way to locate files relative to this module
// (there is no `__dirname` in ESM). `../package.json` works both in dev
// (src/cli.ts) and after build (dist/cli.js) — both sit one level under root.
const pkg: unknown = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const version =
  typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string'
    ? pkg.version
    : '0.0.0';

const program = new Command();

program
  .name('optikit')
  .description('Optimize web assets — images, video, og-image, favicon, svg.')
  .version(version, '-v, --version', 'output the current version');

// Command registry — add a command here and it is wired up uniformly.
const commands: CliCommand[] = [imgCommand];
for (const command of commands) {
  command.register(program);
}

try {
  await program.parseAsync();
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
