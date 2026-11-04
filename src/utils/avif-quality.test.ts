import { describe, expect, it } from 'vitest';
import { avifQualityFor } from './avif-quality.js';

describe('avifQualityFor', () => {
  // Median of three sample photos, compared by SSIM; 85 → 55 also checked by eye.
  it.each([
    [50, 35],
    [60, 40],
    [70, 45],
    [80, 50],
    [85, 55],
    [90, 70],
    [95, 80],
  ])('WebP quality %i looks like AVIF quality %i', (webp, avif) => {
    expect(avifQualityFor(webp)).toBe(avif);
  });

  it('keeps both ends of the scale', () => {
    expect(avifQualityFor(1)).toBe(1);
    expect(avifQualityFor(100)).toBe(100);
  });

  it('falls between two measured points, rounded to a whole number', () => {
    expect(avifQualityFor(75)).toBe(48); // halfway between 45 and 50 → 47.5
    expect(avifQualityFor(88)).toBe(64); // 3/5 of the way from 55 to 70
  });

  it('never drops when the requested quality rises', () => {
    const values = Array.from({ length: 100 }, (_, i) => avifQualityFor(i + 1));
    expect(values.every((value, i) => i === 0 || value >= (values[i - 1] ?? 0))).toBe(true);
  });
});
