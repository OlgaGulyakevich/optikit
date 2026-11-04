import { describe, expect, it } from 'vitest';
import { chooseBackground } from './icon-background.js';

const SIDE = 100;
const LIME = [200, 255, 0, 255] as const;
const CLEAR = [0, 0, 0, 0] as const;

type Rgba = readonly [number, number, number, number];

/** Paint a square RGBA buffer pixel by pixel. */
const paint = (pixel: (x: number, y: number) => Rgba): Uint8Array => {
  const data = new Uint8Array(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) data.set(pixel(x, y), (y * SIDE + x) * 4);
  }
  return data;
};

const insideDisc = (x: number, y: number, radius: number) =>
  Math.hypot(x + 0.5 - SIDE / 2, y + 0.5 - SIDE / 2) <= radius;

/** Rounded square filling the canvas, corner radius 25. */
const insideRoundedSquare = (x: number, y: number) => {
  const dx = Math.max(25 - x - 0.5, x + 0.5 - 75, 0);
  const dy = Math.max(25 - y - 0.5, y + 0.5 - 75, 0);
  return Math.hypot(dx, dy) <= 25;
};

describe('chooseBackground', () => {
  it('leaves a fully opaque icon alone', () => {
    expect(chooseBackground(paint(() => LIME), SIDE)).toEqual({ kind: 'opaque' });
  });

  it("continues a rounded plate's colour into its corners", () => {
    const icon = paint((x, y) => (insideRoundedSquare(x, y) ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'plate', color: '#c8ff00' });
  });

  it('still finds the plate when a dark glyph is drawn on it', () => {
    const icon = paint((x, y) => {
      if (insideDisc(x, y, 20)) return [0, 0, 0, 255];
      return insideRoundedSquare(x, y) ? LIME : CLEAR;
    });
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'plate', color: '#c8ff00' });
  });

  it('treats a disc that reaches the edges as a plate', () => {
    const icon = paint((x, y) => (insideDisc(x, y, 50) ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'plate', color: '#c8ff00' });
  });

  // Filling with the disc's own colour would erase the cut-out: a blank square.
  it('refuses a plate with a see-through cut-out inside', () => {
    const icon = paint((x, y) => (insideDisc(x, y, 50) && !insideDisc(x, y, 15) ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'no-plate' });
  });

  it('refuses a plus sign whose arms touch all four edges', () => {
    const icon = paint((x, y) => ((x >= 40 && x < 60) || (y >= 40 && y < 60) ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'no-plate' });
  });

  it('refuses a glyph floating on transparency', () => {
    const icon = paint((x, y) => (insideDisc(x, y, 30) ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'no-plate' });
  });

  it('refuses a plate with a margin around it', () => {
    const icon = paint((x, y) => (x >= 10 && x < 90 && y >= 10 && y < 90 ? LIME : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'no-plate' });
  });

  // One fill colour would show a seam against at least one side of the gradient.
  it('refuses a plate whose edges are different colours', () => {
    const icon = paint((x, y) => (insideRoundedSquare(x, y) ? [y * 2, 0, 0, 255] : CLEAR));
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'no-plate' });
  });

  it('accepts a soft anti-aliased rim on the plate', () => {
    const icon = paint((x, y) => {
      if (!insideDisc(x, y, 50)) return CLEAR;
      return insideDisc(x, y, 49) ? LIME : [200, 255, 0, 128];
    });
    expect(chooseBackground(icon, SIDE)).toEqual({ kind: 'plate', color: '#c8ff00' });
  });
});
