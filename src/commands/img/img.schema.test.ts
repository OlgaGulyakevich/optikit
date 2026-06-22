import { describe, it, expect } from 'vitest';
import { imgSchema } from './img.schema.js';

describe('imgSchema', () => {
  it('fills defaults when only input is given', () => {
    expect(imgSchema.parse({ input: 'assets' })).toEqual({
      input: 'assets',
      out: 'optimized',
      quality: 85,
      avif: false,
      retina: false,
    });
  });

  it('coerces a string quality to a number', () => {
    expect(imgSchema.parse({ input: 'a', quality: '80' }).quality).toBe(80);
  });

  it('rejects quality out of range', () => {
    expect(() => imgSchema.parse({ input: 'a', quality: 0 })).toThrow();
    expect(() => imgSchema.parse({ input: 'a', quality: 101 })).toThrow();
  });

  it('rejects missing input', () => {
    expect(() => imgSchema.parse({})).toThrow();
  });
});
