import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aspectRatioOf,
  mergePlaceholders,
  parsePlaceholderFile,
  placeholderKey,
  placeholderWidthFor,
} from './placeholder.js';

const entry = (aspectRatio: number) => ({ placeholder: 'data:image/webp;base64,AA', aspectRatio });

describe('placeholderWidthFor', () => {
  it('is an eighth of the poster, wide enough to recognise the frame', () => {
    expect(placeholderWidthFor(720)).toBe(90);
    expect(placeholderWidthFor(1080)).toBe(135);
    expect(placeholderWidthFor(1920)).toBe(240);
  });

  it('does not fall below a usable size on a tiny poster', () => {
    expect(placeholderWidthFor(64)).toBe(16);
  });
});

describe('aspectRatioOf', () => {
  it('gives the number CSS aspect-ratio takes', () => {
    expect(aspectRatioOf(1080, 1920)).toBe(0.5625);
    expect(aspectRatioOf(1920, 1080)).toBe(1.7778);
  });
});

describe('placeholderKey', () => {
  it('is the poster path relative to the output folder', () => {
    expect(placeholderKey('optimized', join('optimized', 'clips', 'a-poster.webp'))).toBe('clips/a-poster.webp');
  });
});

describe('mergePlaceholders', () => {
  it('keeps entries from earlier runs, so one new clip does not wipe the rest', () => {
    expect(Object.keys(mergePlaceholders({ 'a.webp': entry(1) }, { 'b.webp': entry(2) }))).toEqual(['a.webp', 'b.webp']);
  });

  it('lets the new run win for the same poster', () => {
    expect(mergePlaceholders({ 'a.webp': entry(1) }, { 'a.webp': entry(2) })).toEqual({ 'a.webp': entry(2) });
  });

  it('sorts keys, so a re-run gives a clean git diff', () => {
    expect(Object.keys(mergePlaceholders({ 'z.webp': entry(1) }, { 'a.webp': entry(1) }))).toEqual(['a.webp', 'z.webp']);
  });
});

describe('parsePlaceholderFile', () => {
  it('reads a file this command wrote', () => {
    expect(parsePlaceholderFile(JSON.stringify({ 'a.webp': entry(1) }), 'x.json')).toEqual({ 'a.webp': entry(1) });
  });

  // The file is about to be overwritten, so it has to be provably ours (security.md §7.2).
  it.each([
    ['broken JSON', '{ nope'],
    ['an array', '[]'],
    ['some other JSON', '{ "name": "my-app", "version": "1.0.0" }'],
    ['an entry of the wrong shape', '{ "a.webp": { "placeholder": 1 } }'],
  ])('refuses %s and names the file', (_label, text) => {
    expect(() => parsePlaceholderFile(text, 'x.json')).toThrow('x.json');
  });
});
