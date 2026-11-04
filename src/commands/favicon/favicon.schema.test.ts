import { describe, expect, it } from 'vitest';
import { faviconSchema } from './favicon.schema.js';

describe('faviconSchema', () => {
  it('fills defaults when only input is given', () => {
    expect(faviconSchema.parse({ input: 'logo.svg' })).toEqual({ input: 'logo.svg', out: 'optimized' });
  });

  it('accepts a hex colour, with or without the #', () => {
    expect(faviconSchema.parse({ input: 'a', background: '#C8FF00' }).background).toBe('#c8ff00');
    expect(faviconSchema.parse({ input: 'a', background: 'c8ff00' }).background).toBe('#c8ff00');
    expect(faviconSchema.parse({ input: 'a', background: '#fff' }).background).toBe('#ffffff');
  });

  it('rejects anything else before any file is written', () => {
    expect(() => faviconSchema.parse({ input: 'a', background: 'lime' })).toThrow();
    expect(() => faviconSchema.parse({ input: 'a', background: '#12345' })).toThrow();
    expect(() => faviconSchema.parse({ input: 'a', background: '' })).toThrow();
  });
});
