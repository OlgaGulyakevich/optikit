import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectInputs } from './file.service.js';

// Names a person actually gives files, each one a glob metacharacter that used
// to make the file invisible. All are legal on Windows too.
const SPECIAL_NAMES = [
  'Ниша - что в ролике (12 с).mp4',
  'a (1).mp4',
  'take [2].mp4',
  'final {v2}.mp4',
  'a!b.mp4',
  '#1.mp4',
];

// Inside node_modules so the path is relative and on one drive on every OS, and
// an interrupted run leaves nothing in the repo.
let dir: string;
const forward = (path: string) => path.split(sep).join('/');

beforeAll(async () => {
  dir = await mkdtemp(join('node_modules', '.optikit-test-'));
  await mkdir(join(dir, 'clips (old)', 'nested'), { recursive: true });
  await Promise.all([
    ...SPECIAL_NAMES.map((name) => writeFile(join(dir, name), '')),
    writeFile(join(dir, 'plain.mp4'), ''),
    writeFile(join(dir, 'clips (old)', 'one.mp4'), ''),
    writeFile(join(dir, 'clips (old)', 'nested', 'two.mp4'), ''),
  ]);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('collectInputs', () => {
  it.each(SPECIAL_NAMES)('finds a file named %s', async (name) => {
    expect(await collectInputs(join(dir, name))).toEqual([`${forward(dir)}/${name}`]);
  });

  it('expands a directory whose name has parentheses', async () => {
    expect(await collectInputs(join(dir, 'clips (old)'))).toEqual([
      `${forward(dir)}/clips (old)/nested/two.mp4`,
      `${forward(dir)}/clips (old)/one.mp4`,
    ]);
  });

  it('expands a directory given with a trailing separator', async () => {
    expect(await collectInputs(`${join(dir, 'clips (old)')}${sep}`)).toHaveLength(2);
  });

  it('still treats anything that is not on disk as a glob pattern', async () => {
    expect(await collectInputs(`${forward(dir)}/p*.mp4`)).toEqual([`${forward(dir)}/plain.mp4`]);
  });

  it('returns nothing for a path that does not exist', async () => {
    expect(await collectInputs(join(dir, 'missing.mp4'))).toEqual([]);
  });

  it('keeps an absolute path absolute', async () => {
    const absolute = resolve(dir, 'a (1).mp4');
    expect(await collectInputs(absolute)).toEqual([forward(absolute)]);
  });

  it('keeps an absolute directory absolute', async () => {
    const absolute = resolve(dir, 'clips (old)');
    expect(await collectInputs(absolute)).toEqual([
      `${forward(absolute)}/nested/two.mp4`,
      `${forward(absolute)}/one.mp4`,
    ]);
  });

  it('drops a leading ./ the way the glob results always did', async () => {
    expect(await collectInputs(`.${sep}${join(dir, 'plain.mp4')}`)).toEqual([`${forward(dir)}/plain.mp4`]);
  });
});
