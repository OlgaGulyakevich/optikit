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

  // half, not full: a static icon in a 36px badge looked over-shifted at full
  // (Telegram on Yulia's site, 05.10.2026). full stays opt-in, for rotating icons.
  it('defaults to half the correction, report-only, 1% threshold', () => {
    expect(auditSchema.parse({ input: 'icons' })).toMatchObject({ amount: 0.5, fix: false, threshold: 1 });
  });

  it.each(['0', '1.5', 'most'])('rejects %s', (amount) => {
    expect(() => auditSchema.parse({ input: 'icons', amount })).toThrow();
  });
});
