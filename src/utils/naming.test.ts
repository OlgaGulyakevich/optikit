import { describe, it, expect } from 'vitest';
import { buildImageJobs, buildOgJobs, commonBaseDir } from './naming.js';

const opts = { inputBase: 'assets', outDir: 'optimized', quality: 80 };

describe('buildImageJobs', () => {
  it('plain raster → single webp, structure preserved', () => {
    expect(buildImageJobs(['assets/photo.jpg'], opts)).toEqual([
      { input: 'assets/photo.jpg', output: 'optimized/photo.webp', format: 'webp', quality: 80 },
    ]);
  });

  it('mirrors nested sub-folders under the out dir', () => {
    expect(buildImageJobs(['assets/icons/logo.png'], opts)).toEqual([
      { input: 'assets/icons/logo.png', output: 'optimized/icons/logo.webp', format: 'webp', quality: 80 },
    ]);
  });

  it('@2x → 4-variant pack: original @1x/@2x + webp @1x/@2x', () => {
    expect(buildImageJobs(['assets/hero@2x.png'], opts)).toEqual([
      { input: 'assets/hero@2x.png', output: 'optimized/hero@1x.png', format: 'png', quality: 80, scale: 0.5 },
      { input: 'assets/hero@2x.png', output: 'optimized/hero@2x.png', format: 'png', quality: 80 },
      { input: 'assets/hero@2x.png', output: 'optimized/hero@1x.webp', format: 'webp', quality: 80, scale: 0.5 },
      { input: 'assets/hero@2x.png', output: 'optimized/hero@2x.webp', format: 'webp', quality: 80 },
    ]);
  });

  it('@1x without a @2x sibling → webp only', () => {
    expect(buildImageJobs(['assets/logo@1x.png'], opts)).toEqual([
      { input: 'assets/logo@1x.png', output: 'optimized/logo@1x.webp', format: 'webp', quality: 80 },
    ]);
  });

  it('@1x with a @2x sibling → skipped (only the @2x jobs remain)', () => {
    const jobs = buildImageJobs(['assets/logo@1x.png', 'assets/logo@2x.png'], opts);
    expect(jobs).toHaveLength(4);
    expect(jobs.every((job) => job.input === 'assets/logo@2x.png')).toBe(true);
  });

  it('ignores non-raster inputs', () => {
    expect(buildImageJobs(['assets/icon.svg', 'assets/anim.gif'], opts)).toEqual([]);
  });

  it('--avif adds an AVIF variant alongside each WebP', () => {
    expect(buildImageJobs(['assets/photo.jpg'], { ...opts, avif: true })).toEqual([
      { input: 'assets/photo.jpg', output: 'optimized/photo.webp', format: 'webp', quality: 80 },
      { input: 'assets/photo.jpg', output: 'optimized/photo.avif', format: 'avif', quality: 80 },
    ]);
  });

  it('--retina treats a plain image as @2x (full 4-variant pack)', () => {
    const outputs = buildImageJobs(['assets/photo.png'], { ...opts, retina: true }).map(
      (job) => job.output,
    );
    expect(outputs).toEqual([
      'optimized/photo@1x.png',
      'optimized/photo@2x.png',
      'optimized/photo@1x.webp',
      'optimized/photo@2x.webp',
    ]);
  });
});

describe('commonBaseDir', () => {
  it('returns the shared parent of nested files', () => {
    expect(commonBaseDir(['assets/a.png', 'assets/icons/b.png'])).toBe('assets');
  });

  it('handles a flat directory', () => {
    expect(commonBaseDir(['samples/a.png', 'samples/b.jpg'])).toBe('samples');
  });

  it('returns "." for a single top-level file', () => {
    expect(commonBaseDir(['hero.png'])).toBe('.');
  });

  it('returns "." for an empty list', () => {
    expect(commonBaseDir([])).toBe('.');
  });
});

describe('buildOgJobs', () => {
  it('makes a 1200×630 cover JPEG named *-og.jpg', () => {
    expect(buildOgJobs(['assets/hero.png'], { inputBase: 'assets', outDir: 'og', quality: 80 })).toEqual([
      {
        input: 'assets/hero.png',
        output: 'og/hero-og.jpg',
        format: 'jpeg',
        quality: 80,
        resize: { width: 1200, height: 630, fit: 'cover' },
      },
    ]);
  });

  it('mirrors structure and ignores non-raster inputs', () => {
    const outputs = buildOgJobs(['pages/blog/post.jpg', 'pages/icon.svg'], {
      inputBase: 'pages',
      outDir: 'og',
      quality: 80,
    }).map((job) => job.output);
    expect(outputs).toEqual(['og/blog/post-og.jpg']);
  });
});
