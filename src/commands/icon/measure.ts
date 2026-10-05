import { readFile } from 'node:fs/promises';
import { renderAlpha } from '../../tools/sharp.tool.js';
import {
  hasStrokes,
  inkBounds,
  inkCenter,
  inkOffset,
  padViewBox,
  parseViewBox,
  readOpticalMark,
  sizeForRender,
  toUnits,
  withViewBox,
  type Bounds,
  type InkOffset,
  type ViewBox,
} from '../../utils/optical-center.js';

/**
 * Render size for the longer side of the PADDED canvas. A 28-unit icon on a
 * canvas padded to 56 units gets 20 px per unit — rendering error stays far
 * below 0.05 of a unit.
 */
const RENDER_SIDE = 1120;

/**
 * Margin rendered around the canvas, as a share of its longer side. The ink is
 * measured where it really is, not where the viewBox clips it: a drawing that
 * already crosses the edge — or would after a shift — stays visible. Without
 * it, a check after `--fix` measures the clipped result and reports success.
 */
const MARGIN = 0.5;

/** Where the ink of one SVG file sits, measured on a canvas with a margin. */
export interface Measurement {
  /** The file's own canvas. */
  readonly viewBox: ViewBox;
  /** Ink centre relative to the canvas centre. */
  readonly offset: InkOffset;
  /** Where the ink is, in viewBox units — may extend past the canvas. */
  readonly ink: Bounds;
  readonly stroked: boolean;
  /** Strength from a `data-optical` mark, if the icon was centred on purpose. */
  readonly mark: number | undefined;
}

/**
 * Render an SVG and measure its ink.
 *
 * @throws Error if the SVG has no viewBox/size (no canvas to centre in) or draws nothing.
 */
export const measureIcon = async (path: string): Promise<Measurement> => {
  const svg = await readFile(path, 'utf8');
  const viewBox = parseViewBox(svg);
  if (!viewBox) {
    throw new Error(`${path}: no viewBox or width/height — nothing to centre in.`);
  }

  const padded = padViewBox(viewBox, MARGIN);
  const scale = RENDER_SIDE / Math.max(padded.width, padded.height);
  const render = await renderAlpha(
    sizeForRender(withViewBox(svg, padded), Math.round(padded.width * scale), Math.round(padded.height * scale)),
  );

  const center = inkCenter(render.alpha, render.width, render.height);
  const pixels = inkBounds(render.alpha, render.width, render.height);
  if (!center || !pixels) {
    throw new Error(`${path}: renders blank — nothing to measure.`);
  }

  const topLeft = toUnits({ x: pixels.minX, y: pixels.minY }, render, padded);
  const bottomRight = toUnits({ x: pixels.maxX, y: pixels.maxY }, render, padded);

  return {
    viewBox,
    offset: inkOffset(toUnits(center, render, padded), viewBox),
    ink: { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y },
    stroked: hasStrokes(svg),
    mark: readOpticalMark(svg),
  };
};
