#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';

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

// Commands (img, og, video, svg, favicon) get registered here as they land.

program.parse();
