import { describe, it, expect } from 'vitest';
import { resolveVideoConfig } from './resolve-preset.js';

describe('resolveVideoConfig', () => {
  it('applies a preset resolution ceiling', () => {
    expect(resolveVideoConfig({ preset: 'mobile', mute: false }, { crf: 23 })).toEqual({
      crf: 23,
      maxWidth: 1280,
      mute: false,
    });
  });

  it('uses the provided default CRF when --crf is omitted', () => {
    expect(resolveVideoConfig({ mute: false }, { crf: 28 }).crf).toBe(28);
  });

  it('explicit flags win over preset and defaults', () => {
    expect(
      resolveVideoConfig({ preset: 'desktop', crf: 40, maxWidth: 1000, mute: true }, { crf: 28, maxWidth: 1920 }),
    ).toEqual({ crf: 40, maxWidth: 1000, mute: true });
  });

  it('falls back to the default width cap when no preset/flag is given', () => {
    expect(resolveVideoConfig({ mute: false }, { crf: 28, maxWidth: 1920 }).maxWidth).toBe(1920);
  });

  it('no preset and no default cap → no resolution limit', () => {
    expect(resolveVideoConfig({ mute: false }, { crf: 23 }).maxWidth).toBeUndefined();
  });
});
