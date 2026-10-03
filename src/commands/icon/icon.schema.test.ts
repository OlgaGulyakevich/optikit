import { describe, it, expect } from 'vitest';
import { auditSchema } from './icon.schema.js';

describe('auditSchema --amount', () => {
  it.each([
    ['full', 1],
    ['half', 0.5],
    ['0.75', 0.75], // argv gives strings — coerced
  ])('maps %s to %d', (amount, expected) => {
    expect(auditSchema.parse({ input: 'icons', amount }).amount).toBe(expected);
  });

  it('defaults to the full correction, report-only, 1% threshold', () => {
    expect(auditSchema.parse({ input: 'icons' })).toMatchObject({ amount: 1, fix: false, threshold: 1 });
  });

  it.each(['0', '1.5', 'most'])('rejects %s', (amount) => {
    expect(() => auditSchema.parse({ input: 'icons', amount })).toThrow();
  });
});
