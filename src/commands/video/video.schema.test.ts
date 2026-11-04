import { describe, expect, it } from 'vitest';
import { posterSchema } from './video.schema.js';

describe('posterSchema placeholder flags', () => {
  it('is off by default: existing runs write no new file', () => {
    expect(posterSchema.parse({ input: 'a.mp4' }).placeholder).toBe(false);
    expect(posterSchema.parse({ input: 'a.mp4' }).placeholderWidth).toBeUndefined();
  });

  it('coerces a typed width to a number', () => {
    expect(posterSchema.parse({ input: 'a.mp4', placeholder: true, placeholderWidth: '32' }).placeholderWidth).toBe(32);
  });

  it('rejects a width outside 8 to 512', () => {
    expect(() => posterSchema.parse({ input: 'a', placeholder: true, placeholderWidth: 7 })).toThrow();
    expect(() => posterSchema.parse({ input: 'a', placeholder: true, placeholderWidth: 513 })).toThrow();
    expect(posterSchema.parse({ input: 'a', placeholder: true, placeholderWidth: 8 }).placeholderWidth).toBe(8);
    expect(posterSchema.parse({ input: 'a', placeholder: true, placeholderWidth: 512 }).placeholderWidth).toBe(512);
  });

  it('points at the flag when a width comes without --placeholder', () => {
    const issue = posterSchema.safeParse({ input: 'a', placeholderWidth: 32 }).error?.issues[0];
    expect(issue?.path).toEqual(['placeholderWidth']);
  });

  // Candidates are not a final choice yet: which frame would the placeholder show?
  it('refuses --placeholder together with --candidates', () => {
    const issue = posterSchema.safeParse({ input: 'a', placeholder: true, candidates: 3 }).error?.issues[0];
    expect(issue?.path).toEqual(['placeholder']);
  });

  it('allows --placeholder with --at', () => {
    expect(posterSchema.parse({ input: 'a', placeholder: true, at: '2.5' }).at).toBe(2.5);
  });
});
