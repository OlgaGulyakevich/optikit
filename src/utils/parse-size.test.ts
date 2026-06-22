import { describe, it, expect } from 'vitest';
import { parseSize } from './parse-size.js';

describe('parseSize', () => {
  it('parses kb / mb / gb (decimal)', () => {
    expect(parseSize('500kb')).toBe(500_000);
    expect(parseSize('200mb')).toBe(200_000_000);
    expect(parseSize('1.5gb')).toBe(1_500_000_000);
  });

  it('treats a bare number as bytes', () => {
    expect(parseSize('1024')).toBe(1024);
  });

  it('is case-insensitive and tolerates a space', () => {
    expect(parseSize('200MB')).toBe(200_000_000);
    expect(parseSize('  10 mb ')).toBe(10_000_000);
  });

  it('throws on invalid input', () => {
    expect(() => parseSize('abc')).toThrow();
    expect(() => parseSize('')).toThrow();
    expect(() => parseSize('10tb')).toThrow();
  });
});
