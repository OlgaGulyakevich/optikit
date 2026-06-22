import { describe, it, expect } from 'vitest';
import { calcVideoBitrate } from './calc-bitrate.js';

describe('calcVideoBitrate', () => {
  it('derives total bitrate from target size and duration (no audio)', () => {
    // 1_000_000 bytes × 8 / 10 s = 800_000 bits/s
    expect(calcVideoBitrate({ targetBytes: 1_000_000, durationSeconds: 10, audioBitrate: 0 })).toBe(800_000);
  });

  it('reserves the audio bitrate', () => {
    expect(
      calcVideoBitrate({ targetBytes: 1_000_000, durationSeconds: 10, audioBitrate: 128_000 }),
    ).toBe(672_000);
  });

  it('defaults audio to 128 kbps', () => {
    expect(calcVideoBitrate({ targetBytes: 1_000_000, durationSeconds: 10 })).toBe(672_000);
  });

  it('throws on non-positive duration or target', () => {
    expect(() => calcVideoBitrate({ targetBytes: 1_000_000, durationSeconds: 0 })).toThrow();
    expect(() => calcVideoBitrate({ targetBytes: 0, durationSeconds: 10 })).toThrow();
  });

  it('throws when the target is too small for the duration', () => {
    expect(() => calcVideoBitrate({ targetBytes: 100, durationSeconds: 10 })).toThrow();
  });
});
