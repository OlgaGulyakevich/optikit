import { describe, it, expect } from 'vitest';
import { renderAlpha } from '../tools/sharp.tool.js';
import {
  correctionFor,
  hasStrokes,
  inkBounds,
  inkCenter,
  inkOffset,
  padViewBox,
  planFix,
  readOpticalMark,
  toUnits,
  verifyFix,
  withViewBox,
  writeOpticalMark,
  parseViewBox,
  sizeForRender,
  verdictFor,
  wrapInTranslate,
  type InkOffset,
} from './optical-center.js';

/** An alpha plane with opaque pixels wherever `inside(x, y)` holds (pixel centres). */
const paint = (size: number, inside: (x: number, y: number) => boolean): Uint8Array => {
  const alpha = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inside(x + 0.5, y + 0.5)) alpha[y * size + x] = 255;
    }
  }
  return alpha;
};

const offsetOf = (percentX: number, percentY: number): InkOffset => ({
  units: { x: (percentX / 100) * 28, y: (percentY / 100) * 28 },
  percent: { x: percentX, y: percentY },
});

describe('inkCenter', () => {
  it('finds the exact centre of a centred square — no half-pixel drift', () => {
    const alpha = paint(10, (x, y) => x > 3 && x < 7 && y > 3 && y < 7);
    expect(inkCenter(alpha, 10, 10)).toEqual({ x: 5, y: 5 });
  });

  it('puts a triangle\'s centre of mass 1/3 of the height from its base', () => {
    // Base along the top (y = 100), apex at the bottom (y = 400): pointing down.
    const N = 500;
    const alpha = paint(N, (x, y) => y >= 100 && y <= 400 && Math.abs(x - 250) <= ((400 - y) / 300) * 200);
    const center = inkCenter(alpha, N, N);

    expect(center?.x).toBeCloseTo(250, 0);
    expect(center?.y).toBeCloseTo(200, 0); // 100 + 300 / 3, not the box centre 250
  });

  it('weights by opacity: a faint half pulls less than a solid one', () => {
    const alpha = new Uint8Array([255, 85]); // 1×2: solid left pixel, 1/3-opaque right
    expect(inkCenter(alpha, 2, 1)?.x).toBeCloseTo(0.75); // (0.5·3 + 1.5·1) / 4
  });

  it('returns undefined for a blank image', () => {
    expect(inkCenter(new Uint8Array(16), 4, 4)).toBeUndefined();
  });
});

const CANVAS_28 = { minX: 0, minY: 0, width: 28, height: 28 };

describe('toUnits + inkOffset', () => {
  it('converts pixels to viewBox units, then to an offset in units and %', () => {
    const ink = toUnits({ x: 300, y: 280 }, { width: 560, height: 560 }, CANVAS_28); // 20 px per unit
    const offset = inkOffset(ink, CANVAS_28);

    expect(offset.units.x).toBeCloseTo(1);
    expect(offset.units.y).toBeCloseTo(0);
    expect(offset.percent.x).toBeCloseTo(3.571, 3);
  });

  it('respects a padded canvas that starts below zero', () => {
    const padded = padViewBox(CANVAS_28, 0.5); // −14 … 42
    expect(padded).toEqual({ minX: -14, minY: -14, width: 56, height: 56 });
    expect(toUnits({ x: 0, y: 1120 }, { width: 1120, height: 1120 }, padded)).toEqual({ x: -14, y: 42 });
  });
});

describe('inkBounds', () => {
  it('finds the box of the ink in pixel edges', () => {
    const alpha = paint(10, (x, y) => x > 2 && x < 6 && y > 4 && y < 8); // pixel centres 2.5…5.5, 4.5…7.5
    expect(inkBounds(alpha, 10, 10)).toEqual({ minX: 2, minY: 4, maxX: 6, maxY: 8 });
  });

  it('counts a faintly covered pixel — a sharp tip is ink too', () => {
    const alpha = paint(10, (x, y) => x > 2 && x < 6 && y > 4 && y < 8);
    alpha[5 * 10 + 8] = 30; // the thin tip of a wedge: barely covered, still drawn
    expect(inkBounds(alpha, 10, 10)?.maxX).toBe(9);
  });

  it('returns undefined for a blank image', () => {
    expect(inkBounds(new Uint8Array(16), 4, 4)).toBeUndefined();
  });
});

describe('planFix', () => {
  const box = { minX: 0, minY: 0, width: 14, height: 12 };

  it('moves the drawing when it still fits after the shift', () => {
    const ink = { minX: 2, minY: 2, maxX: 10, maxY: 10 };
    expect(planFix(ink, box, { x: 1, y: 0 }, 0.07)).toEqual({ kind: 'translate', shift: { x: 1, y: 0 } });
  });

  it('grows the canvas instead when the shift would push ink past the edge', () => {
    // Wedge touching left/right edges; shift right by 2.33 would cut its tip.
    const ink = { minX: 0, minY: 0, maxX: 14, maxY: 12 };
    const plan = planFix(ink, box, { x: 2.33, y: 0 }, 0.07);
    if (plan.kind !== 'viewBox') throw new Error('expected a viewBox plan');

    // New centre = 7 − 2.33 = 4.67; half-width = 14 − 4.67 = 9.33 → −4.66 … 14.
    expect(plan.viewBox.minX).toBeCloseTo(-4.66, 2);
    expect(plan.viewBox.width).toBeCloseTo(18.67, 1);
    expect(plan.viewBox.height).toBe(12); // never shrinks an axis
    expect(plan.shrink).toBeCloseTo(1 - 14 / 18.67, 2); // ~25% smaller in the same box
  });

  it('counts a shape lying exactly on the edge as fitting (tolerance)', () => {
    const ink = { minX: -0.03, minY: 0, maxX: 13, maxY: 12.04 };
    expect(planFix(ink, box, { x: 0.5, y: 0 }, 0.07).kind).toBe('translate');
  });
});

describe('verifyFix', () => {
  const box = { minX: 0, minY: 0, width: 14, height: 12 };
  const offsetAt = (x: number, y: number) => ({ units: { x, y }, percent: { x: (x / 14) * 100, y: (y / 12) * 100 } });
  const inside = { minX: 1, minY: 1, maxX: 13, maxY: 11 };

  it('passes when the ink landed where promised and nothing crosses the edge', () => {
    expect(verifyFix({ x: 0, y: 0 }, { offset: offsetAt(0.02, 0), ink: inside, viewBox: box }, 0.07)).toBeUndefined();
  });

  it('fails when ink crosses the edge — the bug it exists to catch', () => {
    const cut = { ...inside, maxX: 15.2 };
    expect(verifyFix({ x: 0, y: 0 }, { offset: offsetAt(0, 0), ink: cut, viewBox: box }, 0.07)).toMatch(/cut off/);
  });

  it('fails when the centre missed the target', () => {
    expect(verifyFix({ x: 0, y: 0 }, { offset: offsetAt(0.6, 0), ink: inside, viewBox: box }, 0.07)).toMatch(/expected/);
  });
});

describe('optical mark', () => {
  const svg = '<svg viewBox="0 0 24 24"><path d="M0 0h1"/></svg>';

  it.each([
    [1, 'full'],
    [0.5, 'half'],
    [0.75, '0.75'],
  ])('writes amount %d as "%s" and reads it back', (amount, text) => {
    const marked = writeOpticalMark(svg, amount);
    expect(marked).toContain(`data-optical="${text}"`);
    expect(readOpticalMark(marked)).toBe(amount);
  });

  it('replaces an old mark instead of adding a second one', () => {
    const twice = writeOpticalMark(writeOpticalMark(svg, 1), 0.5);
    expect(twice.match(/data-optical/g)).toHaveLength(1);
    expect(readOpticalMark(twice)).toBe(0.5);
  });

  it('ignores a missing or garbled mark', () => {
    expect(readOpticalMark(svg)).toBeUndefined();
    expect(readOpticalMark('<svg data-optical="lots">')).toBeUndefined();
  });
});

describe('withViewBox', () => {
  it('replaces the root viewBox, or adds one', () => {
    const box = { minX: -1, minY: 0, width: 16.5, height: 12 };
    expect(withViewBox('<svg viewBox="0 0 14 12"><g/></svg>', box)).toBe('<svg viewBox="-1 0 16.5 12"><g/></svg>');
    expect(withViewBox('<svg width="14"><g/></svg>', box)).toBe('<svg viewBox="-1 0 16.5 12" width="14"><g/></svg>');
  });
});

describe('verdictFor', () => {
  it('leaves an offset below the threshold alone', () => {
    expect(verdictFor(offsetOf(0.83, 0), 1, true)).toBe('ok'); // an even-stroke chevron
  });

  it('shifts a filled shape above the threshold, by its worst axis', () => {
    expect(verdictFor(offsetOf(0, -3.57), 1, false)).toBe('shift');
  });

  it('asks for an eye check when strokes may be skewing the number', () => {
    expect(verdictFor(offsetOf(4.05, 0), 1, true)).toBe('check');
  });
});

describe('correctionFor', () => {
  it('moves against the offset, scaled by amount and rounded to 0.01', () => {
    expect(correctionFor(offsetOf(0, -3.5714), 1)).toEqual({ x: 0, y: 1 });
    expect(correctionFor(offsetOf(1.39, 0), 0.75)).toEqual({ x: -0.29, y: 0 });
  });
});

describe('parseViewBox', () => {
  it('reads a viewBox with spaces or commas', () => {
    expect(parseViewBox('<svg viewBox="0 0 28 28">')).toEqual({ minX: 0, minY: 0, width: 28, height: 28 });
    expect(parseViewBox("<svg viewBox='-2,-2,24,20'>")).toEqual({ minX: -2, minY: -2, width: 24, height: 20 });
  });

  it('falls back to width/height, then gives up', () => {
    expect(parseViewBox('<svg width="24px" height="16">')).toEqual({ minX: 0, minY: 0, width: 24, height: 16 });
    expect(parseViewBox('<svg><path/></svg>')).toBeUndefined();
  });
});

describe('sizeForRender', () => {
  it('replaces the root size only, leaving stroke-width and children alone', () => {
    const svg = '<svg width="28" height="28" viewBox="0 0 28 28"><rect width="4" height="4" stroke-width="2"/></svg>';
    expect(sizeForRender(svg, 560, 560)).toBe(
      '<svg width="560" height="560" viewBox="0 0 28 28"><rect width="4" height="4" stroke-width="2"/></svg>',
    );
  });
});

describe('hasStrokes', () => {
  it.each([
    ['attribute', '<path stroke="currentColor"/>'],
    ['style', '<path style="fill:none;stroke:#000"/>'],
  ])('sees a stroke set as %s', (_label, svg) => {
    expect(hasStrokes(svg)).toBe(true);
  });

  it('ignores stroke="none" and stroke-width alone', () => {
    expect(hasStrokes('<path stroke="none" stroke-width="2"/>')).toBe(false);
  });
});

describe('wrapInTranslate', () => {
  it('wraps the content and keeps <title> first for screen readers', () => {
    const svg = '<svg viewBox="0 0 24 24"><title>Play</title><path d="M8 5v14l11-7z"/></svg>';
    expect(wrapInTranslate(svg, { x: 0.33, y: 0 })).toBe(
      '<svg viewBox="0 0 24 24"><title>Play</title><g transform="translate(0.33 0)"><path d="M8 5v14l11-7z"/></g></svg>',
    );
  });
});

// One pass through the real renderer: sharp (librsvg) is in-process and
// deterministic, so this stays fast — and it is the only way to know the
// SVG → pixels → offset chain holds end to end.
describe('triangle through sharp', () => {
  it('measures the known answer: a 28-canvas triangle needs translate(0 1)', async () => {
    const svg = '<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 7.5H24.5L14 24Z" fill="currentColor"/></svg>';
    const render = await renderAlpha(sizeForRender(svg, 560, 560));
    const center = inkCenter(render.alpha, render.width, render.height);
    if (!center) throw new Error('rendered blank');

    // Centroid y = (7.5 + 7.5 + 24) / 3 = 13; canvas centre 14 → shift down by 1.
    const offset = inkOffset(toUnits(center, render, CANVAS_28), CANVAS_28);
    expect(correctionFor(offset, 1)).toEqual({ x: 0, y: 1 });
  });
});
