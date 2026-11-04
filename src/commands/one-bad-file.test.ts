import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CliCommand } from '../core/command.js';
import { imgCommand } from './img/img.command.js';
import { ogCommand } from './og/og.command.js';
import { trimCommand } from './trim/trim.command.js';

// Sorted first on purpose: the good file only gets written if the batch survives this one.
const BROKEN = 'a-broken.png';
const GOOD = 'z-good.png';

let input: string;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'optikit-batch-'));
  input = join(root, 'in');
  await mkdir(input);
  await writeFile(join(input, BROKEN), 'not an image');
  await sharp({ create: { width: 40, height: 40, channels: 4, background: '#c8ff00' } })
    .png()
    .toFile(join(input, GOOD));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each<[string, CliCommand]>([
  ['img', imgCommand],
  ['og', ogCommand],
  ['trim', trimCommand],
])('%s with one broken file', (name, command) => {
  it('still writes the good file, names the broken one, and fails at the end', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const out = join(root, `out-${name}`);

    await expect(command.run({ input, out })).rejects.toThrow('1 of 2 file(s) failed');

    expect((await readdir(out)).some((file) => file.startsWith('z-good'))).toBe(true);
    expect(error.mock.calls.flat().join('\n')).toContain(BROKEN);
  });
});
