import { describe, expect, it } from 'vitest';
import { placeholderConfigSchema } from './placeholder.schema.js';

describe('placeholderConfigSchema', () => {
  it('fills defaults when only input is given', () => {
    expect(placeholderConfigSchema.parse({ input: 'posters' })).toEqual({ input: 'posters', out: 'optimized' });
  });

  it('coerces a typed width to a number', () => {
    expect(placeholderConfigSchema.parse({ input: 'a', width: '32' }).width).toBe(32);
  });

  it('accepts the width limits and rejects just past them', () => {
    expect(placeholderConfigSchema.parse({ input: 'a', width: 8 }).width).toBe(8);
    expect(placeholderConfigSchema.parse({ input: 'a', width: 512 }).width).toBe(512);
    expect(() => placeholderConfigSchema.parse({ input: 'a', width: 7 })).toThrow();
    expect(() => placeholderConfigSchema.parse({ input: 'a', width: 513 })).toThrow();
  });

  it('rejects missing input', () => {
    expect(() => placeholderConfigSchema.parse({})).toThrow();
  });
});
