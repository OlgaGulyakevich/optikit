import { describe, it, expect } from 'vitest';
import {
  formatTimecode,
  frameStats,
  isUsable,
  parseTimecode,
  pickBest,
  pickSpread,
  sampleTimes,
  type FrameStats,
} from './frame-score.js';

/** A size×size greyscale frame filled by `value(x, y)`. */
const frame = (size: number, value: (x: number, y: number) => number): Uint8Array => {
  const gray = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) gray[y * size + x] = value(x, y);
  return gray;
};

const stats = (time: number, brightness: number, sharpness: number): FrameStats => ({ time, brightness, sharpness });

describe('frameStats', () => {
  it('a flat grey frame has no edges — sharpness 0', () => {
    const result = frameStats(frame(16, () => 128), 16, 16, 0);
    expect(result.brightness).toBe(128);
    expect(result.sharpness).toBe(0);
  });

  it('hard edges score sharper than the same pattern blurred', () => {
    const crisp = frame(16, (x) => (Math.floor(x / 4) % 2 === 0 ? 40 : 200)); // hard stripes
    const soft = frame(16, (x) => 120 + 80 * Math.sin((x / 8) * Math.PI)); // smooth gradient

    expect(frameStats(crisp, 16, 16, 0).sharpness).toBeGreaterThan(frameStats(soft, 16, 16, 0).sharpness);
  });
});

describe('isUsable', () => {
  it('rejects black and blown-out frames, keeps normal exposure', () => {
    expect(isUsable(stats(0, 5, 100))).toBe(false); // fade from black
    expect(isUsable(stats(0, 250, 100))).toBe(false); // white flash
    expect(isUsable(stats(0, 110, 100))).toBe(true);
  });
});

describe('sampleTimes', () => {
  it('spreads samples evenly from 5% of the clip, inside the 5–95% window', () => {
    expect(sampleTimes(100, 5)).toEqual([5, 23, 41, 59, 77]); // step = 90 / 5
  });
});

describe('pickBest', () => {
  it('takes the sharpest frame that is not dark', () => {
    const frames = [stats(1, 5, 900), stats(2, 120, 300), stats(3, 130, 500)];
    expect(pickBest(frames)?.time).toBe(3); // the 900 one is a black frame
  });

  it('falls back to the sharpest overall when every frame is dark', () => {
    expect(pickBest([stats(1, 5, 10), stats(2, 8, 30)])?.time).toBe(2);
  });

  it('returns undefined for no frames', () => {
    expect(pickBest([])).toBeUndefined();
  });
});

describe('pickSpread', () => {
  it('takes the best of each part of the clip, not the top-n neighbours', () => {
    // One very sharp scene at the start would win every slot without the split.
    const frames = [
      stats(1, 120, 900),
      stats(2, 120, 950),
      stats(3, 120, 100),
      stats(4, 120, 200),
      stats(5, 120, 120),
      stats(6, 120, 300),
    ];
    expect(pickSpread(frames, 3).map((f) => f.time)).toEqual([2, 4, 6]);
  });
});

describe('parseTimecode / formatTimecode', () => {
  it.each([
    ['4.2', 4.2],
    ['1:05', 65],
    ['00:04.2', 4.2],
    ['01:02:03.5', 3723.5],
  ])('parses %s', (text, seconds) => {
    expect(parseTimecode(text)).toBeCloseTo(seconds);
  });

  it.each(['', 'abc', '4,2', '1:2:3:4', '-1', '1:90', '9:99:99'])('rejects "%s"', (text) => {
    expect(() => parseTimecode(text)).toThrow();
  });

  it('formats back into a form --at accepts', () => {
    expect(formatTimecode(4.24)).toBe('00:04.2');
    expect(formatTimecode(65)).toBe('01:05.0');
    expect(formatTimecode(3723.5)).toBe('1:02:03.5');
    expect(parseTimecode(formatTimecode(37.3))).toBeCloseTo(37.3);
  });
});
